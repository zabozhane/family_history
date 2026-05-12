"""ORM model registry.

Importing this package is enough to register every model with
``Base.metadata`` (Alembic autogenerate relies on this).
"""
from __future__ import annotations

from app.db.models.asset import Asset, AssetType, PermissionScope
from app.db.models.asset_version import AssetVersion
from app.db.models.timeline_entry import TimelineEntry, TimelineEntryKind
from app.db.models.user import User, UserRole
from app.db.models.workspace import (
    Workspace,
    WorkspaceKind,
    WorkspaceMembership,
    WorkspaceMembershipRole,
)

__all__ = [
    "Asset",
    "AssetType",
    "AssetVersion",
    "PermissionScope",
    "TimelineEntry",
    "TimelineEntryKind",
    "User",
    "UserRole",
    "Workspace",
    "WorkspaceKind",
    "WorkspaceMembership",
    "WorkspaceMembershipRole",
]
