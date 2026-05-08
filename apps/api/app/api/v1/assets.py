"""Asset upload routes — multipart → MinIO → Asset + AssetVersion (T6 skeleton)."""
from __future__ import annotations

import logging
from datetime import datetime
from pathlib import PurePosixPath
from uuid import UUID, uuid4

from botocore.exceptions import BotoCoreError, ClientError
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.core.config import settings
from app.db.models.asset import Asset, AssetType, PermissionScope
from app.db.models.asset_version import AssetVersion
from app.db.models.user import User
from app.schemas.asset import AssetUploadResponse
from app.storage.s3 import put_object

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
        title=title.strip() if title else None,
        description=description.strip() if description else None,
        captured_at=ct_parsed,
        permission_scope=PermissionScope.private,
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

    db.add(asset)
    db.add(version)
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
    return AssetUploadResponse(asset=asset, version=version)
