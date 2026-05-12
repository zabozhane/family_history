"""Asset visibility policy — workspace-scoped (T27)."""
from __future__ import annotations

from sqlalchemy import ColumnElement, select

from app.db.models.asset import Asset
from app.db.models.user import User
from app.db.models.workspace import WorkspaceMembership


def asset_read_filter_for_user(user: User) -> ColumnElement[bool]:
    """SQLAlchemy filter: assets in workspaces where ``user`` has any membership."""
    readable = select(WorkspaceMembership.workspace_id).where(WorkspaceMembership.user_id == user.id)
    return Asset.workspace_id.in_(readable)
