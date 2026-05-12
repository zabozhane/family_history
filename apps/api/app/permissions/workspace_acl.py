"""Workspace-scoped capability checks (T27)."""
from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.asset import Asset
from app.db.models.user import User
from app.db.models.workspace import (
    Workspace,
    WorkspaceKind,
    WorkspaceMembership,
    WorkspaceMembershipRole,
)


async def get_membership(
    db: AsyncSession,
    *,
    user_id: UUID,
    workspace_id: UUID,
) -> WorkspaceMembership | None:
    result = await db.execute(
        select(WorkspaceMembership).where(
            WorkspaceMembership.user_id == user_id,
            WorkspaceMembership.workspace_id == workspace_id,
        )
    )
    return result.scalar_one_or_none()


async def user_can_read_workspace(db: AsyncSession, user_id: UUID, workspace_id: UUID) -> bool:
    m = await get_membership(db, user_id=user_id, workspace_id=workspace_id)
    return m is not None


def role_can_write(role: WorkspaceMembershipRole) -> bool:
    return role in (WorkspaceMembershipRole.owner, WorkspaceMembershipRole.editor)


def role_can_delete_asset(
    role: WorkspaceMembershipRole,
    *,
    asset_owner_id: UUID,
    user_id: UUID,
) -> bool:
    if role == WorkspaceMembershipRole.viewer:
        return False
    if role == WorkspaceMembershipRole.owner:
        return True
    # editor: own uploads only
    return asset_owner_id == user_id


async def resolve_default_upload_workspace_id(db: AsyncSession, user_id: UUID) -> UUID:
    """First **personal** workspace where the user is **owner** (oldest by creation)."""
    stmt = (
        select(Workspace.id)
        .join(WorkspaceMembership, WorkspaceMembership.workspace_id == Workspace.id)
        .where(
            WorkspaceMembership.user_id == user_id,
            WorkspaceMembership.role == WorkspaceMembershipRole.owner,
            Workspace.kind == WorkspaceKind.personal,
        )
        .order_by(Workspace.created_at.asc())
        .limit(1)
    )
    result = await db.execute(stmt)
    wid = result.scalar_one_or_none()
    if wid is None:
        from fastapi import HTTPException, status

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No personal workspace for user",
        )
    return wid


async def resolve_upload_workspace_id(
    db: AsyncSession,
    user: User,
    workspace_id: UUID | None,
) -> UUID:
    if workspace_id is None:
        return await resolve_default_upload_workspace_id(db, user.id)
    m = await get_membership(db, user_id=user.id, workspace_id=workspace_id)
    if m is None or not role_can_write(m.role):
        from fastapi import HTTPException, status

        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot upload to this workspace")
    return workspace_id


async def assert_can_read_asset(db: AsyncSession, user: User, asset: Asset) -> None:
    from fastapi import HTTPException, status

    if not await user_can_read_workspace(db, user.id, asset.workspace_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found")


async def require_workspace_owner(
    db: AsyncSession,
    user: User,
    workspace_id: UUID,
) -> Workspace:
    """Load workspace; **403** if current user is not an **owner** member."""
    from fastapi import HTTPException, status

    m = await get_membership(db, user_id=user.id, workspace_id=workspace_id)
    if m is None or m.role != WorkspaceMembershipRole.owner:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Workspace owners only",
        )
    result = await db.execute(select(Workspace).where(Workspace.id == workspace_id))
    ws = result.scalar_one_or_none()
    if ws is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")
    return ws


async def require_workspace_member(
    db: AsyncSession,
    user: User,
    workspace_id: UUID,
) -> tuple[Workspace, WorkspaceMembership]:
    """Load workspace + membership; **403** if not a member."""
    from fastapi import HTTPException, status

    m = await get_membership(db, user_id=user.id, workspace_id=workspace_id)
    if m is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a member of this workspace")
    result = await db.execute(select(Workspace).where(Workspace.id == workspace_id))
    ws = result.scalar_one_or_none()
    if ws is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")
    return ws, m


async def assert_can_delete_asset(db: AsyncSession, user: User, asset: Asset) -> None:
    from fastapi import HTTPException, status

    m = await get_membership(db, user_id=user.id, workspace_id=asset.workspace_id)
    if m is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found")
    if not role_can_delete_asset(m.role, asset_owner_id=asset.owner_id, user_id=user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot delete this asset")
