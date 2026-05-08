"""``Asset`` model — every photo/audio/video/note/document/etc. is an Asset.

Per project spec: *everything is an asset, everything happens in time*.
"""
from __future__ import annotations

import enum
from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPKMixin

if TYPE_CHECKING:
    from app.db.models.asset_version import AssetVersion
    from app.db.models.timeline_entry import TimelineEntry
    from app.db.models.user import User


class AssetType(str, enum.Enum):
    image = "image"
    video = "video"
    audio = "audio"
    note = "note"
    document = "document"
    voice_note = "voice_note"
    link = "link"
    archive = "archive"


class PermissionScope(str, enum.Enum):
    """Visibility scopes per project spec."""

    private = "private"
    family = "family"
    shared = "shared"
    public_link = "public_link"


class Asset(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "assets"

    owner_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    asset_type: Mapped[AssetType] = mapped_column(
        Enum(AssetType, name="asset_type", native_enum=True),
        nullable=False,
        index=True,
    )
    title: Mapped[str | None] = mapped_column(String(500), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    captured_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        index=True,
        comment="When the moment depicted by the asset actually happened.",
    )
    permission_scope: Mapped[PermissionScope] = mapped_column(
        Enum(PermissionScope, name="permission_scope", native_enum=True),
        nullable=False,
        default=PermissionScope.private,
        server_default=PermissionScope.private.value,
    )

    owner: Mapped["User"] = relationship(back_populates="assets")
    versions: Mapped[list["AssetVersion"]] = relationship(
        back_populates="asset",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    timeline_entries: Mapped[list["TimelineEntry"]] = relationship(
        back_populates="asset",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
