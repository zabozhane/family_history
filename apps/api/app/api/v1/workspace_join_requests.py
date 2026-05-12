"""User requests to join shared workspaces + owner approval (notifications)."""
from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user, get_db
from app.db.models.notification import Notification
from app.db.models.user import User
from app.db.models.workspace import (
    Workspace,
    WorkspaceKind,
    WorkspaceMembership,
    WorkspaceMembershipRole,
)
from app.db.models.workspace_join_request import JoinRequestStatus, WorkspaceJoinRequest
from app.constants.notifications import (
    JOIN_REQUEST_APPROVED,
    JOIN_REQUEST_PENDING,
    JOIN_REQUEST_REJECTED,
)
from app.permissions.workspace_acl import get_membership, require_workspace_owner
from app.schemas.join_request import JoinRequestRead, JoinRequestRespond, UserJoinSummary

router = APIRouter()

outgoing_router = APIRouter(prefix="/workspace-join-requests", tags=["workspace-join-requests"])


def _jr_to_read(
    jr: WorkspaceJoinRequest,
    *,
    workspace_name: str,
    requester: UserJoinSummary | None,
) -> JoinRequestRead:
    return JoinRequestRead(
        id=jr.id,
        workspace_id=jr.workspace_id,
        workspace_name=workspace_name,
        status=jr.status,
        created_at=jr.created_at,
        requester=requester,
    )


@router.post("/{workspace_id}/join-requests", response_model=JoinRequestRead, status_code=status.HTTP_201_CREATED)
async def create_join_request(
    workspace_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> JoinRequestRead:
    ws = await db.get(Workspace, workspace_id)
    if ws is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")
    if ws.kind != WorkspaceKind.shared:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only shared workspaces accept join requests",
        )

    existing = await get_membership(db, user_id=user.id, workspace_id=workspace_id)
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You are already a member of this workspace",
        )

    dup = await db.execute(
        select(WorkspaceJoinRequest).where(
            WorkspaceJoinRequest.workspace_id == workspace_id,
            WorkspaceJoinRequest.requester_id == user.id,
            WorkspaceJoinRequest.status == JoinRequestStatus.pending,
        )
    )
    if dup.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You already have a pending request for this workspace",
        )

    jr = WorkspaceJoinRequest(
        workspace_id=workspace_id,
        requester_id=user.id,
        status=JoinRequestStatus.pending,
    )
    db.add(jr)
    await db.flush()

    owners = await db.execute(
        select(WorkspaceMembership.user_id).where(
            WorkspaceMembership.workspace_id == workspace_id,
            WorkspaceMembership.role == WorkspaceMembershipRole.owner,
        )
    )
    owner_ids = list(owners.scalars().all())
    title = f'{user.display_name} requested to join "{ws.name}"'
    for oid in owner_ids:
        db.add(
            Notification(
                recipient_user_id=oid,
                kind=JOIN_REQUEST_PENDING,
                title=title,
                body=None,
                join_request_id=jr.id,
                workspace_id=workspace_id,
            )
        )

    await db.commit()
    await db.refresh(jr)
    return _jr_to_read(jr, workspace_name=ws.name, requester=None)


@router.get("/{workspace_id}/join-requests", response_model=list[JoinRequestRead])
async def list_workspace_join_requests(
    workspace_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[JoinRequestRead]:
    ws = await require_workspace_owner(db, user, workspace_id)
    result = await db.execute(
        select(WorkspaceJoinRequest)
        .where(
            WorkspaceJoinRequest.workspace_id == workspace_id,
            WorkspaceJoinRequest.status == JoinRequestStatus.pending,
        )
        .options(selectinload(WorkspaceJoinRequest.requester))
        .order_by(WorkspaceJoinRequest.created_at.desc())
    )
    rows = result.scalars().all()
    out: list[JoinRequestRead] = []
    for jr in rows:
        req_user = jr.requester
        summ = UserJoinSummary(
            id=req_user.id,
            email=req_user.email,
            display_name=req_user.display_name,
        )
        out.append(_jr_to_read(jr, workspace_name=ws.name, requester=summ))
    return out


@router.delete("/{workspace_id}/join-requests/{request_id}", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_join_request(
    workspace_id: UUID,
    request_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    jr = await db.get(WorkspaceJoinRequest, request_id)
    if jr is None or jr.workspace_id != workspace_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Join request not found")
    if jr.requester_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your join request")
    if jr.status != JoinRequestStatus.pending:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Request is no longer pending")

    await db.execute(delete(WorkspaceJoinRequest).where(WorkspaceJoinRequest.id == jr.id))
    await db.commit()


@router.post("/{workspace_id}/join-requests/{request_id}/respond", response_model=JoinRequestRead)
async def respond_to_join_request(
    workspace_id: UUID,
    request_id: UUID,
    body: JoinRequestRespond,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> JoinRequestRead:
    ws = await require_workspace_owner(db, user, workspace_id)

    result = await db.execute(
        select(WorkspaceJoinRequest)
        .where(
            WorkspaceJoinRequest.id == request_id,
            WorkspaceJoinRequest.workspace_id == workspace_id,
        )
        .with_for_update()
    )
    jr = result.scalar_one_or_none()
    if jr is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Join request not found")
    if jr.status != JoinRequestStatus.pending:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Request already resolved")

    now = datetime.now(timezone.utc)

    await db.execute(delete(Notification).where(Notification.join_request_id == jr.id))

    requester = await db.get(User, jr.requester_id)
    if requester is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Requester missing")

    if body.action == "reject":
        jr.status = JoinRequestStatus.rejected
        jr.resolved_by_id = user.id
        jr.resolved_at = now
        jr.assigned_role = None
        db.add(
            Notification(
                recipient_user_id=jr.requester_id,
                kind=JOIN_REQUEST_REJECTED,
                title=f'Your request to join "{ws.name}" was declined',
                body=None,
                join_request_id=None,
                workspace_id=workspace_id,
            )
        )
        await db.commit()
        await db.refresh(jr)
        summ = UserJoinSummary(id=requester.id, email=requester.email, display_name=requester.display_name)
        return _jr_to_read(jr, workspace_name=ws.name, requester=summ)

    # approve
    role = body.role
    assert role is not None

    dup_m = await get_membership(db, user_id=jr.requester_id, workspace_id=workspace_id)
    if dup_m is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User is already a member of this workspace",
        )

    db.add(
        WorkspaceMembership(
            workspace_id=workspace_id,
            user_id=jr.requester_id,
            role=role,
        )
    )
    jr.status = JoinRequestStatus.approved
    jr.resolved_by_id = user.id
    jr.resolved_at = now
    jr.assigned_role = role.value

    db.add(
        Notification(
            recipient_user_id=jr.requester_id,
            kind=JOIN_REQUEST_APPROVED,
            title=f'You were added to "{ws.name}"',
            body=f"Your role: {role.value}",
            join_request_id=None,
            workspace_id=workspace_id,
        )
    )

    await db.commit()
    await db.refresh(jr)
    summ = UserJoinSummary(id=requester.id, email=requester.email, display_name=requester.display_name)
    return _jr_to_read(jr, workspace_name=ws.name, requester=summ)


@outgoing_router.get("", response_model=list[JoinRequestRead])
async def list_my_outgoing_join_requests(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[JoinRequestRead]:
    stmt = (
        select(WorkspaceJoinRequest, Workspace.name)
        .join(Workspace, WorkspaceJoinRequest.workspace_id == Workspace.id)
        .where(WorkspaceJoinRequest.requester_id == user.id)
        .order_by(WorkspaceJoinRequest.created_at.desc())
    )
    result = await db.execute(stmt)
    out: list[JoinRequestRead] = []
    for jr, ws_name in result.all():
        out.append(_jr_to_read(jr, workspace_name=ws_name, requester=None))
    return out
