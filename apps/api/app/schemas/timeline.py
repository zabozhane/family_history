"""Timeline API schemas."""
from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel

from app.db.models.asset import AssetType, PermissionScope
from app.db.models.timeline_entry import TimelineEntryKind


class TimelineAssetVersionRead(BaseModel):
    id: UUID
    storage_key: str
    mime_type: str
    size_bytes: int
    width: int | None = None
    height: int | None = None
    duration_ms: int | None = None


class TimelineAssetRead(BaseModel):
    id: UUID
    owner_id: UUID
    asset_type: AssetType
    title: str | None
    description: str | None
    captured_at: datetime | None
    permission_scope: PermissionScope


class TimelineItemRead(BaseModel):
    id: UUID
    user_id: UUID
    asset_id: UUID | None
    kind: TimelineEntryKind
    occurred_at: datetime
    payload: dict[str, Any]
    asset: TimelineAssetRead | None = None
    primary_version: TimelineAssetVersionRead | None = None
