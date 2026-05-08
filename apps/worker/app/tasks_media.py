"""Media-related Dramatiq actors (consumer implementations).

API declares a producer stub with the same ``actor_name`` /
``queue_name`` — keep those strings in sync across repos/processes.
"""
from __future__ import annotations

import logging

import dramatiq

logger = logging.getLogger(__name__)


@dramatiq.actor(
    actor_name="extract_asset_version_metadata",
    queue_name="media",
    max_retries=3,
)
def extract_asset_version_metadata(asset_version_id: str) -> None:
    """T7 stub — logs ID; T8 will ffprobe/Pillow/mutagen + DB update."""
    logger.info(
        "[worker] extract_asset_version_metadata (stub): asset_version_id=%s",
        asset_version_id,
    )
