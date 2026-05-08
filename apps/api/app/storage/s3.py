"""Async S3-compatible uploads using aioboto3 (works with MinIO via path-style)."""
from __future__ import annotations

import aioboto3
from botocore.config import Config

from app.core.config import settings

_session = aioboto3.Session()


def _client_kwargs() -> dict[str, object]:
    return {
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


async def put_object(key: str, body: bytes, content_type: str) -> None:
    async with _session.client("s3", **_client_kwargs()) as client:
        await client.put_object(
            Bucket=settings.S3_BUCKET,
            Key=key,
            Body=body,
            ContentType=content_type,
        )
