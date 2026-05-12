"""Workspace API schemas (T27)."""
from __future__ import annotations

from datetime import datetime
from typing import ClassVar
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.db.models.workspace import WorkspaceKind, WorkspaceMembershipRole


class WorkspaceRead(BaseModel):
    model_config: ClassVar[ConfigDict] = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    kind: WorkspaceKind
    created_by_id: UUID
    created_at: datetime
    updated_at: datetime
    membership_role: WorkspaceMembershipRole = Field(
        ...,
        description="Current user's role in this workspace",
    )


class WorkspaceCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    kind: WorkspaceKind
