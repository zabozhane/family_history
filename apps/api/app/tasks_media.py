"""Dramatiq actors declared on the API side (producer-only stubs).

The worker ships an equivalent module with the same ``actor_name`` /
``queue_name`` so messages deserialize to the consumer implementation.

Real metadata extraction runs in T8.
"""
from __future__ import annotations

import dramatiq


@dramatiq.actor(
    actor_name="extract_asset_version_metadata",
    queue_name="media",
    max_retries=3,
)
def extract_asset_version_metadata(asset_version_id: str) -> None:
    """Never executed in the API — declaration exists only for ``.send()``."""
