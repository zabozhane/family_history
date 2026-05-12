"""notifications.workspace_id for per-library filtering

Revision ID: notifications_workspace_id_004
Revises: join_requests_notifications_003
Create Date: 2026-05-12

"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "notifications_workspace_id_004"
down_revision: Union[str, Sequence[str], None] = "join_requests_notifications_003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "notifications",
        sa.Column("workspace_id", sa.UUID(), nullable=True),
    )
    op.create_foreign_key(
        "fk_notifications_workspace_id_workspaces",
        "notifications",
        "workspaces",
        ["workspace_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_index(
        op.f("ix_notifications_workspace_id"),
        "notifications",
        ["workspace_id"],
        unique=False,
    )
    op.execute(
        """
        UPDATE notifications n
        SET workspace_id = jr.workspace_id
        FROM workspace_join_requests jr
        WHERE n.join_request_id = jr.id AND n.workspace_id IS NULL;
        """
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_notifications_workspace_id"), table_name="notifications")
    op.drop_constraint("fk_notifications_workspace_id_workspaces", "notifications", type_="foreignkey")
    op.drop_column("notifications", "workspace_id")
