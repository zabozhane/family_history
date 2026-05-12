"""Accept workspace invitation by token (T28)."""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.db.models.user import User
from app.db.models.workspace import Workspace, WorkspaceMembership, WorkspaceMembershipRole
from app.db.models.workspace_invitation import WorkspaceInvitation
from app.permissions.workspace_acl import get_membership
from app.schemas.invitation import AcceptInvitationBody
from app.schemas.workspace import WorkspaceRead

router = APIRouter()


@router.post("/accept", response_model=WorkspaceRead)
async def accept_invitation(
    body: AcceptInvitationBody,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> WorkspaceRead:
    """Consume a pending invitation; caller must be logged in as the **invited email**."""
    token = body.token.strip()
    result = await db.execute(select(WorkspaceInvitation).where(WorkspaceInvitation.token == token))
    inv = result.scalar_one_or_none()
    if inv is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invitation not found")

    now = datetime.now(timezone.utc)
    if inv.consumed_at is not None:
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="Invitation already used")
    if inv.expires_at < now:
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="Invitation expired")

    if user.email.lower() != inv.email.lower():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Sign in as the invited email address to accept",
        )

    role = WorkspaceMembershipRole(inv.role)
    if role not in (WorkspaceMembershipRole.viewer, WorkspaceMembershipRole.editor):
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Invalid invitation role")

    existing = await get_membership(db, user_id=user.id, workspace_id=inv.workspace_id)
    if existing is None:
        db.add(
            WorkspaceMembership(
                workspace_id=inv.workspace_id,
                user_id=user.id,
                role=role,
            ),
        )

    inv.consumed_at = now
    await db.commit()

    ws = await db.get(Workspace, inv.workspace_id)
    if ws is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")
    m = await get_membership(db, user_id=user.id, workspace_id=inv.workspace_id)
    if m is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Membership missing after accept")

    return WorkspaceRead(
        id=ws.id,
        name=ws.name,
        kind=ws.kind,
        created_by_id=ws.created_by_id,
        created_at=ws.created_at,
        updated_at=ws.updated_at,
        membership_role=m.role,
    )
