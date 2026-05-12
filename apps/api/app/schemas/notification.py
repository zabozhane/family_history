"""In-app notification schemas."""
from __future__ import annotations

from datetime import datetime
from typing import ClassVar
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.db.models.workspace_join_request import JoinRequestStatus
from app.schemas.join_request import UserJoinSummary


class JoinRequestNotificationPayload(BaseModel):
    """Embedded join request context for owner notifications."""

    model_config: ClassVar[ConfigDict] = ConfigDict(from_attributes=True)

    id: UUID
    workspace_id: UUID
    workspace_name: str
    status: JoinRequestStatus
    requester: UserJoinSummary


class NotificationRead(BaseModel):
    id: UUID
    kind: str
    title: str
    body: str | None
    read_at: datetime | None
    created_at: datetime
    join_request: JoinRequestNotificationPayload | None = None
