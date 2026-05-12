"""Workspace CRUD — list + create (T27)."""
from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.db.models.user import User
from app.db.models.workspace import (
    Workspace,
    WorkspaceKind,
    WorkspaceMembership,
    WorkspaceMembershipRole,
)
from app.schemas.workspace import WorkspaceCreate, WorkspaceRead

router = APIRouter()


@router.get("", response_model=list[WorkspaceRead])
async def list_workspaces(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[WorkspaceRead]:
    """Workspaces the current user belongs to, with membership role."""
    stmt = (
        select(Workspace, WorkspaceMembership.role)
        .join(WorkspaceMembership, WorkspaceMembership.workspace_id == Workspace.id)
        .where(WorkspaceMembership.user_id == user.id)
        .order_by(Workspace.created_at.asc())
    )
    result = await db.execute(stmt)
    out: list[WorkspaceRead] = []
    for ws, role in result.all():
        out.append(
            WorkspaceRead(
                id=ws.id,
                name=ws.name,
                kind=ws.kind,
                created_by_id=ws.created_by_id,
                created_at=ws.created_at,
                updated_at=ws.updated_at,
                membership_role=role,
            )
        )
    return out


@router.post("", response_model=WorkspaceRead, status_code=status.HTTP_201_CREATED)
async def create_workspace(
    body: WorkspaceCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> WorkspaceRead:
    """Create a workspace and grant the current user **owner** membership."""
    ws = Workspace(
        name=body.name.strip(),
        kind=body.kind,
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
    await db.commit()
    await db.refresh(ws)
    return WorkspaceRead(
        id=ws.id,
        name=ws.name,
        kind=ws.kind,
        created_by_id=ws.created_by_id,
        created_at=ws.created_at,
        updated_at=ws.updated_at,
        membership_role=WorkspaceMembershipRole.owner,
    )
