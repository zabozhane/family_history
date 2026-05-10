"""Async S3-compatible uploads using aioboto3 (works with MinIO via path-style)."""
from __future__ import annotations

from collections.abc import AsyncIterator

import aioboto3
from botocore.config import Config
from botocore.exceptions import ClientError

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


async def head_object_content_length(key: str) -> int:
    """Return object size in bytes (raises ClientError if missing)."""
    async with _session.client("s3", **_client_kwargs()) as client:
        response = await client.head_object(Bucket=settings.S3_BUCKET, Key=key)
        return int(response["ContentLength"])


async def iter_object_chunks(
    key: str,
    *,
    byte_range: tuple[int, int] | None = None,
    chunk_size: int = 65536,
) -> AsyncIterator[bytes]:
    """Stream object bytes from the configured bucket (raises ClientError on failure).

    When ``byte_range`` is ``(start, end)`` inclusive, uses S3 ranged GET so browsers
    can seek video via HTTP Range requests.
    """
    async with _session.client("s3", **_client_kwargs()) as client:
        kwargs: dict[str, object] = {
            "Bucket": settings.S3_BUCKET,
            "Key": key,
        }
        if byte_range is not None:
            start, end = byte_range
            kwargs["Range"] = f"bytes={start}-{end}"
        response = await client.get_object(**kwargs)
        body = response["Body"]
        while True:
            chunk = await body.read(chunk_size)
            if not chunk:
                break
            yield chunk


async def delete_object(key: str) -> None:
    """Remove object from bucket; ignores missing key."""
    async with _session.client("s3", **_client_kwargs()) as client:
        try:
            await client.delete_object(Bucket=settings.S3_BUCKET, Key=key)
        except ClientError as exc:
            code = exc.response.get("Error", {}).get("Code", "")
            if code in ("404", "NoSuchKey", "NotFound"):
                return
            raise


async def head_object_exists(key: str) -> bool:
    """Return True if the object exists (False for missing key)."""
    async with _session.client("s3", **_client_kwargs()) as client:
        try:
            await client.head_object(Bucket=settings.S3_BUCKET, Key=key)
            return True
        except ClientError as exc:
            code = exc.response.get("Error", {}).get("Code", "")
            if code in ("404", "NoSuchKey", "NotFound"):
                return False
            raise
