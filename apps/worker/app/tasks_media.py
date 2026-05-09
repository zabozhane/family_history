"""Media-related Dramatiq actors (consumer implementations)."""
from __future__ import annotations

import asyncio
import json
import logging
from uuid import UUID

import aioboto3
import asyncpg
import dramatiq
from botocore.config import Config

from app.core.config import settings
from app.media_processing import (
    extract_audio_metadata,
    extract_image_metadata,
    extract_video_metadata,
)

logger = logging.getLogger(__name__)
_session = aioboto3.Session()


async def _fetch_asset_version(conn: asyncpg.Connection, version_id: UUID) -> asyncpg.Record | None:
    return await conn.fetchrow(
        """
        SELECT id, storage_key, mime_type
        FROM asset_versions
        WHERE id = $1
        """,
        version_id,
    )


async def _download_object(storage_key: str) -> bytes:
    kwargs = {
        "endpoint_url": settings.S3_ENDPOINT_URL,
        "aws_access_key_id": settings.S3_ACCESS_KEY,
        "aws_secret_access_key": settings.S3_SECRET_KEY,
        "region_name": settings.S3_REGION,
        "use_ssl": settings.S3_USE_SSL,
        "config": Config(
            signature_version="s3v4",
            s3={"addressing_style": "path"},
        ),
    }
    async with _session.client("s3", **kwargs) as client:
        response = await client.get_object(Bucket=settings.S3_BUCKET, Key=storage_key)
        body = await response["Body"].read()
    return body


def _extract_for_mime(mime: str, payload: bytes) -> tuple[int | None, int | None, int | None, dict]:
    if mime.startswith("image/"):
        return extract_image_metadata(payload)
    if mime.startswith("audio/"):
        return extract_audio_metadata(payload)
    if mime.startswith("video/"):
        return extract_video_metadata(payload)
    return None, None, None, {"extractor": "none", "reason": f"unsupported mime: {mime}"}


async def _process_asset_version(asset_version_id: str) -> None:
    version_uuid = UUID(asset_version_id)
    conn = await asyncpg.connect(settings.postgres_dsn)
    try:
        row = await _fetch_asset_version(conn, version_uuid)
        if row is None:
            logger.warning(
                "[worker] asset_version not found, skip metadata extraction: id=%s",
                asset_version_id,
            )
            return

        payload = await _download_object(row["storage_key"])
        width, height, duration_ms, media_metadata = _extract_for_mime(row["mime_type"], payload)
        media_metadata["mime_type"] = row["mime_type"]

        await conn.execute(
            """
            UPDATE asset_versions
            SET width = $2,
                height = $3,
                duration_ms = $4,
                metadata = $5::jsonb,
                updated_at = NOW()
            WHERE id = $1
            """,
            version_uuid,
            width,
            height,
            duration_ms,
            json.dumps(media_metadata),
        )
        logger.info(
            "[worker] extracted metadata: version_id=%s mime=%s width=%s height=%s duration_ms=%s",
            asset_version_id,
            row["mime_type"],
            width,
            height,
            duration_ms,
        )
    finally:
        await conn.close()


@dramatiq.actor(
    actor_name="extract_asset_version_metadata",
    queue_name="media",
    max_retries=3,
)
def extract_asset_version_metadata(asset_version_id: str) -> None:
    """Extract metadata from object storage and update ``asset_versions``."""
    asyncio.run(_process_asset_version(asset_version_id))
