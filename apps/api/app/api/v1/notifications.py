"""List and mark read for in-app notifications."""
from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user, get_db
from app.constants.notifications import JOIN_REQUEST_PENDING
from app.db.models.notification import Notification
from app.db.models.user import User
from app.db.models.workspace_join_request import WorkspaceJoinRequest
from app.schemas.join_request import UserJoinSummary
from app.schemas.notification import JoinRequestNotificationPayload, NotificationRead

router = APIRouter()


def _to_read(n: Notification) -> NotificationRead:
    payload: JoinRequestNotificationPayload | None = None
    if (
        n.kind == JOIN_REQUEST_PENDING
        and n.join_request_id is not None
        and n.join_request is not None
    ):
        jr = n.join_request
        ws = jr.workspace
        req = jr.requester
        if ws is not None and req is not None:
            payload = JoinRequestNotificationPayload(
                id=jr.id,
                workspace_id=jr.workspace_id,
                workspace_name=ws.name,
                status=jr.status,
                requester=UserJoinSummary(
                    id=req.id,
                    email=req.email,
                    display_name=req.display_name,
                ),
            )

    return NotificationRead(
        id=n.id,
        kind=n.kind,
        title=n.title,
        body=n.body,
        read_at=n.read_at,
        created_at=n.created_at,
        join_request=payload,
    )


@router.get("", response_model=list[NotificationRead])
async def list_notifications(
    workspace_id: UUID | None = Query(
        default=None,
        description="Only notifications for this workspace (join requests, approvals).",
    ),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[NotificationRead]:
    options = (
        selectinload(Notification.join_request).selectinload(WorkspaceJoinRequest.workspace),
        selectinload(Notification.join_request).selectinload(WorkspaceJoinRequest.requester),
    )
    if workspace_id is None:
        stmt = (
            select(Notification)
            .where(Notification.recipient_user_id == user.id)
            .options(*options)
            .order_by(Notification.created_at.desc())
            .limit(50)
        )
    else:
        stmt = (
            select(Notification)
            .outerjoin(
                WorkspaceJoinRequest,
                Notification.join_request_id == WorkspaceJoinRequest.id,
            )
            .where(
                Notification.recipient_user_id == user.id,
                or_(
                    Notification.workspace_id == workspace_id,
                    WorkspaceJoinRequest.workspace_id == workspace_id,
                ),
            )
            .options(*options)
            .order_by(Notification.created_at.desc())
            .limit(50)
        )
    result = await db.execute(stmt)
    rows = result.scalars().all()
    return [_to_read(n) for n in rows]


@router.patch("/{notification_id}/read", response_model=NotificationRead)
async def mark_notification_read(
    notification_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> NotificationRead:
    result = await db.execute(
        select(Notification)
        .where(
            Notification.id == notification_id,
            Notification.recipient_user_id == user.id,
        )
        .options(
            selectinload(Notification.join_request).selectinload(WorkspaceJoinRequest.workspace),
            selectinload(Notification.join_request).selectinload(WorkspaceJoinRequest.requester),
        )
    )
    n = result.scalar_one_or_none()
    if n is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")
    if n.read_at is None:
        n.read_at = datetime.now(timezone.utc)
        await db.commit()
        await db.refresh(n)
        result = await db.execute(
            select(Notification)
            .where(Notification.id == notification_id)
            .options(
                selectinload(Notification.join_request).selectinload(WorkspaceJoinRequest.workspace),
                selectinload(Notification.join_request).selectinload(WorkspaceJoinRequest.requester),
            )
        )
        n = result.scalar_one()
    return _to_read(n)
