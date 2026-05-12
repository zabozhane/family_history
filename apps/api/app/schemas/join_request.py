"""Workspace join request schemas."""
from __future__ import annotations

from datetime import datetime
from typing import ClassVar, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator

from app.db.models.workspace_join_request import JoinRequestStatus
from app.db.models.workspace import WorkspaceMembershipRole


class UserJoinSummary(BaseModel):
    """Minimal user info for owners reviewing a join request."""

    model_config: ClassVar[ConfigDict] = ConfigDict(from_attributes=True)

    id: UUID
    email: EmailStr
    display_name: str


class JoinRequestRead(BaseModel):
    """Join request with workspace name and optional requester (owner-only list)."""

    id: UUID
    workspace_id: UUID
    workspace_name: str
    status: JoinRequestStatus
    created_at: datetime
    requester: UserJoinSummary | None = None


class JoinRequestRespond(BaseModel):
    action: Literal["approve", "reject"]
    role: WorkspaceMembershipRole | None = Field(
        default=None,
        description="Required when approving: viewer or editor",
    )

    @model_validator(mode="after")
    def validate_role(self) -> JoinRequestRespond:
        if self.action == "approve":
            if self.role not in (WorkspaceMembershipRole.viewer, WorkspaceMembershipRole.editor):
                raise ValueError("role must be viewer or editor when approving")
        elif self.role is not None:
            raise ValueError("role must be omitted when rejecting")
        return self
