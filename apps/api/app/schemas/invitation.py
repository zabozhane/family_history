"""Workspace invitation schemas (T28)."""
from __future__ import annotations

from datetime import datetime
from typing import ClassVar, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.db.models.workspace import WorkspaceMembershipRole


class InvitationCreate(BaseModel):
    email: EmailStr
    role: Literal["viewer", "editor"]


class InvitationRead(BaseModel):
    model_config: ClassVar[ConfigDict] = ConfigDict(from_attributes=True)

    id: UUID
    workspace_id: UUID
    email: str
    role: str
    invited_by_id: UUID
    expires_at: datetime
    created_at: datetime
    consumed_at: datetime | None


class InvitationCreated(InvitationRead):
    """Returned once when creating an invitation — includes opaque ``token``."""

    token: str = Field(..., description="Single-use token for POST /api/v1/invitations/accept")


class AcceptInvitationBody(BaseModel):
    token: str = Field(..., min_length=8, max_length=64)


class WorkspaceMemberRead(BaseModel):
    user_id: UUID
    email: str
    display_name: str
    role: WorkspaceMembershipRole


class MemberRoleUpdate(BaseModel):
    role: Literal["viewer", "editor"]
