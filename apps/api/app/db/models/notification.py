"""In-app notifications (e.g. workspace join requests for owners)."""
from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPKMixin

if TYPE_CHECKING:
    from app.db.models.user import User
    from app.db.models.workspace import Workspace
    from app.db.models.workspace_join_request import WorkspaceJoinRequest


class Notification(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "notifications"

    recipient_user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    kind: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    body: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    join_request_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("workspace_join_requests.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    workspace_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    read_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    recipient: Mapped["User"] = relationship(
        back_populates="notifications",
        foreign_keys=[recipient_user_id],
    )
    join_request: Mapped["WorkspaceJoinRequest | None"] = relationship(
        "WorkspaceJoinRequest",
        foreign_keys=[join_request_id],
    )
    workspace: Mapped["Workspace | None"] = relationship(
        "Workspace",
        foreign_keys=[workspace_id],
    )
