"""``TimelineEntry`` model — denormalised entries for the unified timeline.

The timeline itself is a *projection* (per architecture.json) but storing
entries lets us index them by ``occurred_at`` and filter by user/scope
efficiently in T11. Each entry may or may not point at an Asset.
"""
from __future__ import annotations

import enum
from datetime import datetime
from typing import TYPE_CHECKING, Any
from uuid import UUID

from sqlalchemy import DateTime, Enum, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPKMixin

if TYPE_CHECKING:
    from app.db.models.asset import Asset
    from app.db.models.user import User


class TimelineEntryKind(str, enum.Enum):
    asset_added = "asset_added"
    event = "event"
    activity = "activity"


class TimelineEntry(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "timeline_entries"

    user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    asset_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("assets.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    kind: Mapped[TimelineEntryKind] = mapped_column(
        Enum(TimelineEntryKind, name="timeline_entry_kind", native_enum=True),
        nullable=False,
        index=True,
    )
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
    )
    payload: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        nullable=False,
        default=dict,
        server_default="{}",
    )

    user: Mapped["User"] = relationship(back_populates="timeline_entries")
    asset: Mapped["Asset | None"] = relationship(back_populates="timeline_entries")
