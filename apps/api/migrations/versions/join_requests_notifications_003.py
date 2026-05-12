"""workspace join requests + notifications

Revision ID: join_requests_notifications_003
Revises: workspace_invitations_002
Create Date: 2026-05-10

"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "join_requests_notifications_003"
down_revision: Union[str, Sequence[str], None] = "workspace_invitations_002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    status_enum = sa.Enum("pending", "approved", "rejected", name="join_request_status")

    op.create_table(
        "workspace_join_requests",
        sa.Column("workspace_id", sa.UUID(), nullable=False),
        sa.Column("requester_id", sa.UUID(), nullable=False),
        sa.Column("status", status_enum, nullable=False),
        sa.Column("resolved_by_id", sa.UUID(), nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("assigned_role", sa.String(length=20), nullable=True),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["requester_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["resolved_by_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_workspace_join_requests_requester_id"),
        "workspace_join_requests",
        ["requester_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_workspace_join_requests_workspace_id"),
        "workspace_join_requests",
        ["workspace_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_workspace_join_requests_status"),
        "workspace_join_requests",
        ["status"],
        unique=False,
    )

    op.create_table(
        "notifications",
        sa.Column("recipient_user_id", sa.UUID(), nullable=False),
        sa.Column("kind", sa.String(length=64), nullable=False),
        sa.Column("title", sa.String(length=300), nullable=False),
        sa.Column("body", sa.String(length=2000), nullable=True),
        sa.Column("join_request_id", sa.UUID(), nullable=True),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["join_request_id"], ["workspace_join_requests.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["recipient_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_notifications_join_request_id"), "notifications", ["join_request_id"], unique=False)
    op.create_index(op.f("ix_notifications_kind"), "notifications", ["kind"], unique=False)
    op.create_index(
        op.f("ix_notifications_recipient_user_id"),
        "notifications",
        ["recipient_user_id"],
        unique=False,
    )

    op.execute(
        """
        CREATE UNIQUE INDEX uq_workspace_join_pending_user
        ON workspace_join_requests (workspace_id, requester_id)
        WHERE status = 'pending';
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS uq_workspace_join_pending_user")
    op.drop_index(op.f("ix_notifications_recipient_user_id"), table_name="notifications")
    op.drop_index(op.f("ix_notifications_kind"), table_name="notifications")
    op.drop_index(op.f("ix_notifications_join_request_id"), table_name="notifications")
    op.drop_table("notifications")
    op.drop_index(op.f("ix_workspace_join_requests_status"), table_name="workspace_join_requests")
    op.drop_index(op.f("ix_workspace_join_requests_workspace_id"), table_name="workspace_join_requests")
    op.drop_index(op.f("ix_workspace_join_requests_requester_id"), table_name="workspace_join_requests")
    op.drop_table("workspace_join_requests")
    op.execute("DROP TYPE IF EXISTS join_request_status")
