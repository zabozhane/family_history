"""Asset upload routes — multipart → MinIO → Asset + AssetVersion (T6 skeleton)."""
from __future__ import annotations

import logging
from collections.abc import Sequence
from datetime import datetime, timezone
from pathlib import PurePosixPath
from uuid import UUID, uuid4

from botocore.exceptions import BotoCoreError, ClientError
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import Response, StreamingResponse
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import set_committed_value

from app.api.deps import get_current_user, get_db
from app.core.config import settings
from app.db.models.asset import Asset, AssetType, PermissionScope
from app.db.models.asset_version import AssetVersion
from app.db.models.timeline_entry import TimelineEntry, TimelineEntryKind
from app.db.models.user import User, UserRole
from app.permissions.assets import asset_read_filter_for_user, can_read_asset
from app.schemas.asset import AssetPermissionRead, AssetRead, AssetUploadResponse, AssetVersionRead
from app.storage.s3 import delete_object, head_object_exists, iter_object_chunks, put_object
from app.tasks_media import extract_asset_version_metadata

logger = logging.getLogger(__name__)

router = APIRouter()

_MIME_TO_EXT: dict[str, str] = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "image/heic": ".heic",
    "video/mp4": ".mp4",
    "video/quicktime": ".mov",
    "video/webm": ".webm",
    "audio/mpeg": ".mp3",
    "audio/mp4": ".m4a",
    "audio/wav": ".wav",
    "audio/flac": ".flac",
    "audio/ogg": ".ogg",
}


def _normalized_mime(upload: UploadFile) -> str:
    raw = upload.content_type or "application/octet-stream"
    return raw.split(";")[0].strip().lower()


def _mime_to_asset_type(mime: str) -> AssetType | None:
    if mime.startswith("image/"):
        return AssetType.image
    if mime.startswith("video/"):
        return AssetType.video
    if mime.startswith("audio/"):
        return AssetType.audio
    return None


def _suffix_from_upload(filename: str | None, mime: str) -> str:
    if filename:
        suf = PurePosixPath(filename).suffix.lower()
        if suf and len(suf) <= 12:
            return suf
    return _MIME_TO_EXT.get(mime, ".bin")


def _resolved_asset_title(title: str | None, filename: str | None) -> str | None:
    """Use explicit Form title when provided; otherwise derive from upload filename stem."""
    if title and title.strip():
        return title.strip()
    if filename:
        stem = PurePosixPath(filename).stem.strip()
        if stem:
            return stem
    return None


def _parse_captured_at(raw: str | None) -> datetime | None:
    if raw is None:
        return None
    text = raw.strip()
    if not text:
        return None
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="captured_at must be ISO 8601 datetime",
        ) from exc


async def _load_asset_or_404(db: AsyncSession, asset_id: UUID) -> Asset:
    result = await db.execute(select(Asset).where(Asset.id == asset_id))
    asset = result.scalar_one_or_none()
    if asset is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found")
    return asset


async def _load_asset_with_versions(db: AsyncSession, asset_id: UUID) -> Asset | None:
    result = await db.execute(select(Asset).where(Asset.id == asset_id))
    asset = result.scalar_one_or_none()
    if asset is None:
        return None
    vres = await db.execute(select(AssetVersion).where(AssetVersion.asset_id == asset_id))
    versions = list(vres.scalars().all())
    set_committed_value(asset, "versions", versions)
    return asset


def _pick_primary_version_from_rows(versions: Sequence[AssetVersion]) -> AssetVersion | None:
    if not versions:
        return None
    for version in versions:
        if version.is_primary:
            return version
    return max(versions, key=lambda v: v.created_at)


def serialize_asset_read(
    asset: Asset,
    *,
    version_rows: Sequence[AssetVersion] | None = None,
) -> AssetRead:
    rows = list(version_rows) if version_rows is not None else list(asset.versions)
    primary = _pick_primary_version_from_rows(rows)
    return AssetRead(
        id=asset.id,
        owner_id=asset.owner_id,
        asset_type=asset.asset_type,
        title=asset.title,
        description=asset.description,
        captured_at=asset.captured_at,
        created_at=asset.created_at,
        permission_scope=asset.permission_scope,
        primary_version=AssetVersionRead.model_validate(primary) if primary else None,
    )


@router.post(
    "",
    response_model=AssetUploadResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_asset(
    file: UploadFile = File(...),
    title: str | None = Form(None),
    description: str | None = Form(None),
    captured_at: str | None = Form(None),
    permission_scope: PermissionScope = Form(PermissionScope.private),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> AssetUploadResponse:
    mime = _normalized_mime(file)
    asset_type = _mime_to_asset_type(mime)
    if asset_type is None:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Only image/*, video/*, and audio/* uploads are supported in this skeleton.",
        )

    body = await file.read()
    size = len(body)
    if size == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Empty file",
        )
    if size > settings.API_UPLOAD_MAX_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File exceeds configured upload limit",
        )

    ct_parsed = _parse_captured_at(captured_at)
    asset_id: UUID = uuid4()
    version_id: UUID = uuid4()
    ext = _suffix_from_upload(file.filename, mime)
    storage_key = f"{user.id}/{asset_id}/{version_id}{ext}"

    asset = Asset(
        id=asset_id,
        owner_id=user.id,
        asset_type=asset_type,
        title=_resolved_asset_title(title, file.filename),
        description=description.strip() if description else None,
        captured_at=ct_parsed,
        permission_scope=permission_scope,
    )
    version = AssetVersion(
        id=version_id,
        asset_id=asset_id,
        storage_key=storage_key,
        mime_type=mime,
        size_bytes=size,
        width=None,
        height=None,
        duration_ms=None,
        is_primary=True,
    )
    timeline_entry = TimelineEntry(
        user_id=user.id,
        asset_id=asset_id,
        kind=TimelineEntryKind.asset_added,
        occurred_at=ct_parsed or datetime.now(timezone.utc),
        payload={
            "event": "asset_uploaded",
            "asset_type": asset_type.value,
            "permission_scope": permission_scope.value,
        },
    )

    db.add(asset)
    db.add(version)
    db.add(timeline_entry)
    await db.flush()

    try:
        await put_object(storage_key, body, mime)
    except (ClientError, BotoCoreError) as exc:
        await db.rollback()
        logger.exception("S3 put_object failed for key=%s", storage_key)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Object storage upload failed",
        ) from exc

    await db.commit()
    await db.refresh(asset)
    await db.refresh(version)

    try:
        extract_asset_version_metadata.send(str(version.id))
    except Exception:
        logger.exception(
            "Failed to enqueue extract_asset_version_metadata for version_id=%s",
            version.id,
        )

    ver_read = AssetVersionRead.model_validate(version)
    asset_read = AssetRead(
        id=asset.id,
        owner_id=asset.owner_id,
        asset_type=asset.asset_type,
        title=asset.title,
        description=asset.description,
        captured_at=asset.captured_at,
        created_at=asset.created_at,
        permission_scope=asset.permission_scope,
        primary_version=ver_read,
    )
    return AssetUploadResponse(asset=asset_read, version=ver_read)


@router.get("", response_model=list[AssetRead])
async def list_assets(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[AssetRead]:
    stmt = (
        select(Asset)
        .where(asset_read_filter_for_user(user))
        .order_by(Asset.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    result = await db.execute(stmt)
    assets = result.scalars().all()
    if not assets:
        return []
    asset_ids = [a.id for a in assets]
    vstmt = select(AssetVersion).where(AssetVersion.asset_id.in_(asset_ids))
    vrows = (await db.execute(vstmt)).scalars().all()
    # Use string keys — avoids rare driver/type mismatches on UUID dict lookups.
    by_asset: dict[str, list[AssetVersion]] = {}
    for ver in vrows:
        by_asset.setdefault(str(ver.asset_id), []).append(ver)
    return [
        serialize_asset_read(asset, version_rows=by_asset.get(str(asset.id), []))
        for asset in assets
    ]


@router.get("/{asset_id}/file")
async def stream_asset_file(
    asset_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> StreamingResponse:
    asset = await _load_asset_with_versions(db, asset_id)
    if asset is None or not can_read_asset(user, asset):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found")
    primary = _pick_primary_version_from_rows(list(asset.versions))
    if primary is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No media version for asset",
        )
    if not await head_object_exists(primary.storage_key):
        logger.error("Storage object missing for asset_id=%s key=%s", asset_id, primary.storage_key)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Media object missing",
        )

    filename = (asset.title or str(asset.id)).replace('"', "")[:200]
    headers = {
        "Content-Disposition": f'inline; filename="{filename}"',
        "Cache-Control": "private, max-age=3600",
    }
    return StreamingResponse(
        iter_object_chunks(primary.storage_key),
        media_type=primary.mime_type,
        headers=headers,
    )


@router.delete("/{asset_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_asset(
    asset_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Response:
    asset = await _load_asset_with_versions(db, asset_id)
    if asset is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found")
    if asset.owner_id != user.id and user.role != UserRole.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot delete this asset")
    for ver in list(asset.versions):
        try:
            await delete_object(ver.storage_key)
        except (ClientError, BotoCoreError) as exc:
            logger.warning(
                "delete_object failed for key=%s (continuing): %s",
                ver.storage_key,
                exc,
            )
    await db.execute(delete(Asset).where(Asset.id == asset_id))
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{asset_id}", response_model=AssetRead)
async def get_asset(
    asset_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> AssetRead:
    asset = await _load_asset_with_versions(db, asset_id)
    if asset is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found")
    if not can_read_asset(user, asset):
        # Return 404 to avoid leaking existence.
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found")
    return serialize_asset_read(asset)


@router.get("/{asset_id}/permission", response_model=AssetPermissionRead)
async def get_asset_permission(
    asset_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> AssetPermissionRead:
    asset = await _load_asset_or_404(db, asset_id)
    if not can_read_asset(user, asset):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found")
    is_owner = asset.owner_id == user.id
    can_edit = is_owner or user.role == UserRole.admin
    return AssetPermissionRead(
        asset_id=asset.id,
        permission_scope=asset.permission_scope,
        is_owner=is_owner,
        can_read=True,
        can_edit=can_edit,
    )
