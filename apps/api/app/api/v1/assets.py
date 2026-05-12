"""Asset upload routes — multipart → MinIO → Asset + AssetVersion (T6 skeleton)."""
from __future__ import annotations

import logging
from collections.abc import Sequence
from datetime import datetime, timezone
from pathlib import PurePosixPath
from uuid import UUID, uuid4

from botocore.exceptions import BotoCoreError, ClientError
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile, status
from fastapi.responses import Response, StreamingResponse
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy.orm.attributes import set_committed_value

from app.api.deps import get_current_user, get_current_user_detached, get_db
from app.db.session import AsyncSessionLocal
from app.core.config import settings
from app.db.models.asset import Asset, AssetType, PermissionScope
from app.db.models.asset_version import AssetVersion
from app.db.models.timeline_entry import TimelineEntry, TimelineEntryKind
from app.db.models.user import User
from app.permissions.assets import asset_read_filter_for_user
from app.permissions.workspace_acl import (
    assert_can_delete_asset,
    assert_can_read_asset,
    get_membership,
    resolve_upload_workspace_id,
    role_can_write,
)
from app.schemas.asset import (
    AssetPermissionRead,
    AssetRead,
    AssetUploaderRead,
    AssetUploadResponse,
    AssetVersionRead,
)
from app.storage.s3 import delete_object, head_object_content_length, iter_object_chunks, put_object
from app.tasks_media import extract_asset_version_metadata

logger = logging.getLogger(__name__)

router = APIRouter()


def _parse_http_range(range_header: str | None, total: int) -> tuple[int, int] | None:
    """Parse a single ``Range: bytes=…`` value; return inclusive (start, end) or ``None`` for full body.

    Multipart range lists are not implemented — returns ``None`` so the client receives a full 200
    response (still with ``Accept-Ranges`` / ``Content-Length``, which is enough for many players).

    Raises ``HTTPException(416)`` when the range is syntactically valid but unsatisfiable.
    """
    if total <= 0 or not range_header:
        return None
    h = range_header.strip()
    if not h.lower().startswith("bytes="):
        return None
    spec = h[6:].strip()
    if not spec or "," in spec:
        return None

    if spec.startswith("-"):
        try:
            suffix_len = int(spec[1:])
        except ValueError:
            return None
        if suffix_len <= 0:
            return None
        start = max(0, total - suffix_len)
        end = total - 1
        return (start, end)

    if "-" not in spec:
        return None
    left, right = spec.split("-", 1)
    try:
        start = int(left) if left.strip() else 0
    except ValueError:
        return None
    if right.strip() == "":
        end = total - 1
    else:
        try:
            end = int(right)
        except ValueError:
            return None

    if start < 0:
        start = 0
    if start >= total:
        raise HTTPException(
            status_code=status.HTTP_416_REQUESTED_RANGE_NOT_SATISFIABLE,
            detail="Range not satisfiable",
            headers={"Content-Range": f"bytes */{total}"},
        )
    end = min(end, total - 1)
    if end < start:
        raise HTTPException(
            status_code=status.HTTP_416_REQUESTED_RANGE_NOT_SATISFIABLE,
            detail="Range not satisfiable",
            headers={"Content-Range": f"bytes */{total}"},
        )
    return (start, end)

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
    result = await db.execute(
        select(Asset).where(Asset.id == asset_id).options(selectinload(Asset.owner)),
    )
    asset = result.scalar_one_or_none()
    if asset is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found")
    return asset


async def _load_asset_with_versions(db: AsyncSession, asset_id: UUID) -> Asset | None:
    result = await db.execute(
        select(Asset).where(Asset.id == asset_id).options(selectinload(Asset.owner)),
    )
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
    uploader: User | None = None,
) -> AssetRead:
    rows = list(version_rows) if version_rows is not None else list(asset.versions)
    primary = _pick_primary_version_from_rows(rows)

    if uploader is not None and uploader.id == asset.owner_id:
        uploaded_by = AssetUploaderRead(id=uploader.id, display_name=uploader.display_name)
    elif getattr(asset, "owner", None) is not None:
        ou = asset.owner
        uploaded_by = AssetUploaderRead(id=ou.id, display_name=ou.display_name)
    else:
        uploaded_by = AssetUploaderRead(id=asset.owner_id, display_name="Unknown")

    return AssetRead(
        id=asset.id,
        workspace_id=asset.workspace_id,
        owner_id=asset.owner_id,
        uploaded_by=uploaded_by,
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
    workspace_id: UUID | None = Form(None),
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
    resolved_workspace_id = await resolve_upload_workspace_id(db, user, workspace_id)

    asset_id: UUID = uuid4()
    version_id: UUID = uuid4()
    ext = _suffix_from_upload(file.filename, mime)
    storage_key = f"{user.id}/{asset_id}/{version_id}{ext}"

    asset = Asset(
        id=asset_id,
        workspace_id=resolved_workspace_id,
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
    return AssetUploadResponse(
        asset=serialize_asset_read(asset, version_rows=[version], uploader=user),
        version=ver_read,
    )


@router.get("", response_model=list[AssetRead])
async def list_assets(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    workspace_id: UUID | None = Query(None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[AssetRead]:
    if workspace_id is not None:
        m = await get_membership(db, user_id=user.id, workspace_id=workspace_id)
        if m is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not a member of this workspace",
            )
    stmt = (
        select(Asset)
        .where(asset_read_filter_for_user(user))
        .options(selectinload(Asset.owner))
    )
    if workspace_id is not None:
        stmt = stmt.where(Asset.workspace_id == workspace_id)
    stmt = stmt.order_by(Asset.created_at.desc()).limit(limit).offset(offset)
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


async def _resolve_asset_file_parts(
    db: AsyncSession,
    user: User,
    asset_id: UUID,
) -> tuple[Asset, AssetVersion, int]:
    asset = await _load_asset_with_versions(db, asset_id)
    if asset is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found")
    await assert_can_read_asset(db, user, asset)
    primary = _pick_primary_version_from_rows(list(asset.versions))
    if primary is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No media version for asset",
        )
    try:
        total_size = await head_object_content_length(primary.storage_key)
    except ClientError as exc:
        code = exc.response.get("Error", {}).get("Code", "")
        if code in ("404", "NoSuchKey", "NotFound"):
            logger.error(
                "Storage object missing for asset_id=%s key=%s",
                asset_id,
                primary.storage_key,
            )
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Media object missing",
            ) from exc
        raise
    return asset, primary, total_size


@router.head("/{asset_id}/file")
async def head_asset_file(
    asset_id: UUID,
    user: User = Depends(get_current_user_detached),
) -> Response:
    """Support HEAD probes (some media stacks send HEAD before ranged GET)."""
    async with AsyncSessionLocal() as db:
        asset, primary, total_size = await _resolve_asset_file_parts(db, user, asset_id)
        filename = (asset.title or str(asset.id)).replace('"', "")[:200]
        mime_type = primary.mime_type
    return Response(
        media_type=mime_type,
        headers={
            "Content-Disposition": f'inline; filename="{filename}"',
            "Cache-Control": "private, max-age=3600",
            "Accept-Ranges": "bytes",
            "Content-Length": str(total_size),
        },
    )


@router.get("/{asset_id}/file")
async def stream_asset_file(
    request: Request,
    asset_id: UUID,
    user: User = Depends(get_current_user_detached),
) -> StreamingResponse:
    # Resolve metadata in a **short** DB session; return the stream *after* the
    # session closes so range requests do not hold a pool connection for the
    # whole video duration.
    async with AsyncSessionLocal() as db:
        asset, primary, total_size = await _resolve_asset_file_parts(db, user, asset_id)
        filename = (asset.title or str(asset.id)).replace('"', "")[:200]
        storage_key = primary.storage_key
        mime_type = primary.mime_type
        span = _parse_http_range(request.headers.get("range"), total_size)

    base_headers = {
        "Content-Disposition": f'inline; filename="{filename}"',
        "Cache-Control": "private, max-age=3600",
        "Accept-Ranges": "bytes",
    }

    if span is None:
        headers = {**base_headers, "Content-Length": str(total_size)}
        return StreamingResponse(
            iter_object_chunks(storage_key),
            media_type=mime_type,
            headers=headers,
        )

    start, end = span
    chunk_len = end - start + 1
    headers = {
        **base_headers,
        "Content-Range": f"bytes {start}-{end}/{total_size}",
        "Content-Length": str(chunk_len),
    }
    return StreamingResponse(
        iter_object_chunks(storage_key, byte_range=(start, end)),
        status_code=status.HTTP_206_PARTIAL_CONTENT,
        media_type=mime_type,
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
    await assert_can_delete_asset(db, user, asset)
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
    await assert_can_read_asset(db, user, asset)
    return serialize_asset_read(asset)


@router.get("/{asset_id}/permission", response_model=AssetPermissionRead)
async def get_asset_permission(
    asset_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> AssetPermissionRead:
    asset = await _load_asset_or_404(db, asset_id)
    await assert_can_read_asset(db, user, asset)
    m = await get_membership(db, user_id=user.id, workspace_id=asset.workspace_id)
    is_owner = asset.owner_id == user.id
    can_edit = bool(m and role_can_write(m.role))
    return AssetPermissionRead(
        asset_id=asset.id,
        permission_scope=asset.permission_scope,
        is_owner=is_owner,
        can_read=True,
        can_edit=can_edit,
    )
