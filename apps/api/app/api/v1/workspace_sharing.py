"""Invitations and member management for workspaces (T28)."""
from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.db.models.user import User
from app.db.models.workspace import (
    Workspace,
    WorkspaceKind,
    WorkspaceMembership,
    WorkspaceMembershipRole,
)
from app.db.models.workspace_invitation import WorkspaceInvitation
from app.permissions.workspace_acl import get_membership, require_workspace_owner
from app.schemas.invitation import (
    InvitationCreate,
    InvitationCreated,
    InvitationRead,
    MemberRoleUpdate,
    WorkspaceMemberRead,
)

router = APIRouter()

INVITE_TTL_DAYS = 7


def _normalize_email(email: str) -> str:
    return email.strip().lower()


@router.post("/{workspace_id}/invitations", response_model=InvitationCreated, status_code=status.HTTP_201_CREATED)
async def create_workspace_invitation(
    workspace_id: UUID,
    body: InvitationCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> InvitationCreated:
    ws = await require_workspace_owner(db, user, workspace_id)
    if ws.kind != WorkspaceKind.shared:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invitations are only available for shared workspaces",
        )

    email_norm = _normalize_email(str(body.email))
    pending = await db.execute(
        select(WorkspaceInvitation).where(
            WorkspaceInvitation.workspace_id == workspace_id,
            WorkspaceInvitation.email == email_norm,
            WorkspaceInvitation.consumed_at.is_(None),
        )
    )
    if pending.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An active invitation already exists for this email",
        )

    ur = await db.execute(select(User).where(User.email == email_norm))
    existing_user = ur.scalar_one_or_none()
    if existing_user is not None:
        om = await get_membership(db, user_id=existing_user.id, workspace_id=workspace_id)
        if om is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="User is already a member of this workspace",
            )

    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(days=INVITE_TTL_DAYS)
    inv = WorkspaceInvitation(
        workspace_id=workspace_id,
        email=email_norm,
        token=token,
        role=body.role,
        invited_by_id=user.id,
        expires_at=expires_at,
    )
    db.add(inv)
    await db.commit()
    await db.refresh(inv)

    base = InvitationRead.model_validate(inv)
    return InvitationCreated(**base.model_dump(), token=token)


@router.get("/{workspace_id}/invitations", response_model=list[InvitationRead])
async def list_workspace_invitations(
    workspace_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[InvitationRead]:
    await require_workspace_owner(db, user, workspace_id)
    result = await db.execute(
        select(WorkspaceInvitation)
        .where(
            WorkspaceInvitation.workspace_id == workspace_id,
            WorkspaceInvitation.consumed_at.is_(None),
        )
        .order_by(WorkspaceInvitation.created_at.desc())
    )
    rows = result.scalars().all()
    return [InvitationRead.model_validate(r) for r in rows]


@router.delete("/{workspace_id}/invitations/{invitation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_workspace_invitation(
    workspace_id: UUID,
    invitation_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    await require_workspace_owner(db, user, workspace_id)
    result = await db.execute(
        select(WorkspaceInvitation).where(
            WorkspaceInvitation.id == invitation_id,
            WorkspaceInvitation.workspace_id == workspace_id,
        )
    )
    inv = result.scalar_one_or_none()
    if inv is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invitation not found")
    await db.execute(delete(WorkspaceInvitation).where(WorkspaceInvitation.id == invitation_id))
    await db.commit()


@router.get("/{workspace_id}/members", response_model=list[WorkspaceMemberRead])
async def list_workspace_members(
    workspace_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[WorkspaceMemberRead]:
    m = await get_membership(db, user_id=user.id, workspace_id=workspace_id)
    if m is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a member of this workspace")

    stmt = (
        select(User.email, User.display_name, WorkspaceMembership.user_id, WorkspaceMembership.role)
        .join(WorkspaceMembership, WorkspaceMembership.user_id == User.id)
        .where(WorkspaceMembership.workspace_id == workspace_id)
        .order_by(User.email.asc())
    )
    result = await db.execute(stmt)
    out: list[WorkspaceMemberRead] = []
    for email, display_name, uid, role in result.all():
        out.append(
            WorkspaceMemberRead(
                user_id=uid,
                email=email,
                display_name=display_name,
                role=role,
            )
        )
    return out


@router.patch("/{workspace_id}/members/{member_user_id}", response_model=WorkspaceMemberRead)
async def update_member_role(
    workspace_id: UUID,
    member_user_id: UUID,
    body: MemberRoleUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> WorkspaceMemberRead:
    await require_workspace_owner(db, user, workspace_id)

    result = await db.execute(
        select(WorkspaceMembership).where(
            WorkspaceMembership.workspace_id == workspace_id,
            WorkspaceMembership.user_id == member_user_id,
        )
    )
    target = result.scalar_one_or_none()
    if target is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")
    if target.role == WorkspaceMembershipRole.owner:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot change the workspace owner role here",
        )

    new_role = WorkspaceMembershipRole(body.role)
    target.role = new_role
    await db.commit()

    ur = await db.execute(select(User).where(User.id == member_user_id))
    u = ur.scalar_one()
    return WorkspaceMemberRead(
        user_id=u.id,
        email=u.email,
        display_name=u.display_name,
        role=new_role,
    )


@router.delete("/{workspace_id}/members/{member_user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_workspace_member(
    workspace_id: UUID,
    member_user_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    await require_workspace_owner(db, user, workspace_id)

    result = await db.execute(
        select(WorkspaceMembership).where(
            WorkspaceMembership.workspace_id == workspace_id,
            WorkspaceMembership.user_id == member_user_id,
        )
    )
    target = result.scalar_one_or_none()
    if target is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")
    if target.role == WorkspaceMembershipRole.owner:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot remove the workspace owner",
        )

    await db.execute(
        delete(WorkspaceMembership).where(
            WorkspaceMembership.workspace_id == workspace_id,
            WorkspaceMembership.user_id == member_user_id,
        )
    )
    await db.commit()
