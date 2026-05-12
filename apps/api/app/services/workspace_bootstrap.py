"""Create default workspaces for new users (T27)."""
from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.user import User
from app.db.models.workspace import (
    Workspace,
    WorkspaceKind,
    WorkspaceMembership,
    WorkspaceMembershipRole,
)


async def create_personal_workspace_for_user(db: AsyncSession, user: User) -> Workspace:
    """Insert a **Personal** workspace and **owner** membership for ``user``."""
    ws = Workspace(
        name="Personal",
        kind=WorkspaceKind.personal,
        created_by_id=user.id,
    )
    db.add(ws)
    await db.flush()
    db.add(
        WorkspaceMembership(
            workspace_id=ws.id,
            user_id=user.id,
            role=WorkspaceMembershipRole.owner,
        ),
    )
    return ws
