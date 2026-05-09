"""Asset / AssetVersion Pydantic schemas."""
from __future__ import annotations

from datetime import datetime
from typing import Any, ClassVar
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.db.models.asset import AssetType, PermissionScope


class AssetVersionRead(BaseModel):
    model_config: ClassVar[ConfigDict] = ConfigDict(from_attributes=True)

    id: UUID
    asset_id: UUID
    storage_key: str
    mime_type: str
    size_bytes: int
    width: int | None = None
    height: int | None = None
    duration_ms: int | None = None
    is_primary: bool
    media_metadata: dict[str, Any]


class AssetRead(BaseModel):
    model_config: ClassVar[ConfigDict] = ConfigDict(from_attributes=True)

    id: UUID
    owner_id: UUID
    asset_type: AssetType
    title: str | None
    description: str | None
    captured_at: datetime | None
    permission_scope: PermissionScope
    primary_version: AssetVersionRead | None = None


class AssetUploadResponse(BaseModel):
    asset: AssetRead
    version: AssetVersionRead


class AssetPermissionRead(BaseModel):
    asset_id: UUID
    permission_scope: PermissionScope
    is_owner: bool
    can_read: bool
    can_edit: bool
