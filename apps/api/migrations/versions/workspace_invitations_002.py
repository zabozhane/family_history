"""workspace invitations (T28)

Revision ID: workspace_invitations_002
Revises: workspace_tenant_001
Create Date: 2026-05-10

"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "workspace_invitations_002"
down_revision: Union[str, Sequence[str], None] = "workspace_tenant_001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "workspace_invitations",
        sa.Column("workspace_id", sa.UUID(), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("token", sa.String(length=64), nullable=False),
        sa.Column("role", sa.String(length=20), nullable=False),
        sa.Column("invited_by_id", sa.UUID(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("consumed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["invited_by_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_workspace_invitations_email"), "workspace_invitations", ["email"], unique=False)
    op.create_index(op.f("ix_workspace_invitations_workspace_id"), "workspace_invitations", ["workspace_id"], unique=False)
    op.create_index("ix_workspace_invitations_token", "workspace_invitations", ["token"], unique=True)
    op.execute(
        """
        CREATE UNIQUE INDEX uq_workspace_inv_pending_email
        ON workspace_invitations (workspace_id, email)
        WHERE consumed_at IS NULL;
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS uq_workspace_inv_pending_email")
    op.drop_index("ix_workspace_invitations_token", table_name="workspace_invitations")
    op.drop_index(op.f("ix_workspace_invitations_workspace_id"), table_name="workspace_invitations")
    op.drop_index(op.f("ix_workspace_invitations_email"), table_name="workspace_invitations")
    op.drop_table("workspace_invitations")
