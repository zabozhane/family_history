"""Workspace (tenant) — library / timeline scope for assets."""
from __future__ import annotations

import enum
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import Enum, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPKMixin

if TYPE_CHECKING:
    from app.db.models.asset import Asset
    from app.db.models.user import User
    from app.db.models.workspace_invitation import WorkspaceInvitation
    from app.db.models.workspace_join_request import WorkspaceJoinRequest


class WorkspaceKind(str, enum.Enum):
    personal = "personal"
    shared = "shared"


class WorkspaceMembershipRole(str, enum.Enum):
    owner = "owner"
    editor = "editor"
    viewer = "viewer"


class Workspace(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "workspaces"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    kind: Mapped[WorkspaceKind] = mapped_column(
        Enum(WorkspaceKind, name="workspace_kind", native_enum=True),
        nullable=False,
        index=True,
    )
    created_by_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    created_by: Mapped["User"] = relationship(
        "User",
        foreign_keys=[created_by_id],
        back_populates="workspaces_created",
    )
    memberships: Mapped[list["WorkspaceMembership"]] = relationship(
        back_populates="workspace",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    assets: Mapped[list["Asset"]] = relationship(
        "Asset",
        back_populates="workspace",
        passive_deletes=False,
    )
    invitations: Mapped[list["WorkspaceInvitation"]] = relationship(
        "WorkspaceInvitation",
        back_populates="workspace",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    join_requests: Mapped[list["WorkspaceJoinRequest"]] = relationship(
        "WorkspaceJoinRequest",
        back_populates="workspace",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class WorkspaceMembership(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "workspace_memberships"
    __table_args__ = (
        UniqueConstraint("workspace_id", "user_id", name="uq_workspace_membership_workspace_user"),
    )

    workspace_id: Mapped[UUID] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    role: Mapped[WorkspaceMembershipRole] = mapped_column(
        Enum(WorkspaceMembershipRole, name="workspace_membership_role", native_enum=True),
        nullable=False,
    )

    workspace: Mapped["Workspace"] = relationship(back_populates="memberships")
    user: Mapped["User"] = relationship(back_populates="workspace_memberships")
