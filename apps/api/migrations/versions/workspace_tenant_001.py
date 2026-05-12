"""workspace tenant + asset.workspace_id

Revision ID: workspace_tenant_001
Revises: 216b02aa5afa
Create Date: 2026-05-10

"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "workspace_tenant_001"
down_revision: Union[str, Sequence[str], None] = "216b02aa5afa"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Let ``create_table`` emit ``CREATE TYPE`` once per enum (manual ``.create()`` duplicates it).
    workspace_kind_enum = sa.Enum("personal", "shared", name="workspace_kind")
    role_enum = sa.Enum("owner", "editor", "viewer", name="workspace_membership_role")

    op.create_table(
        "workspaces",
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column(
            "kind",
            workspace_kind_enum,
            nullable=False,
        ),
        sa.Column("created_by_id", sa.UUID(), nullable=False),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["created_by_id"], ["users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_workspaces_created_by_id"), "workspaces", ["created_by_id"], unique=False)
    op.create_index(op.f("ix_workspaces_kind"), "workspaces", ["kind"], unique=False)

    op.create_table(
        "workspace_memberships",
        sa.Column("workspace_id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("role", role_enum, nullable=False),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("workspace_id", "user_id", name="uq_workspace_membership_workspace_user"),
    )
    op.create_index(op.f("ix_workspace_memberships_user_id"), "workspace_memberships", ["user_id"], unique=False)
    op.create_index(op.f("ix_workspace_memberships_workspace_id"), "workspace_memberships", ["workspace_id"], unique=False)

    op.add_column("assets", sa.Column("workspace_id", sa.UUID(), nullable=True))
    op.create_foreign_key(
        "fk_assets_workspace_id_workspaces",
        "assets",
        "workspaces",
        ["workspace_id"],
        ["id"],
        ondelete="RESTRICT",
    )

    op.execute(
        """
        INSERT INTO workspaces (id, name, kind, created_by_id, created_at, updated_at)
        SELECT gen_random_uuid(), 'Personal', 'personal', id, now(), now()
        FROM users;
        """
    )
    op.execute(
        """
        INSERT INTO workspace_memberships (id, workspace_id, user_id, role, created_at, updated_at)
        SELECT gen_random_uuid(), w.id, w.created_by_id, 'owner', now(), now()
        FROM workspaces w;
        """
    )
    op.execute(
        """
        UPDATE assets AS a
        SET workspace_id = w.id
        FROM workspaces w
        WHERE w.created_by_id = a.owner_id AND w.kind = 'personal';
        """
    )

    op.alter_column("assets", "workspace_id", nullable=False)
    op.create_index(op.f("ix_assets_workspace_id"), "assets", ["workspace_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_assets_workspace_id"), table_name="assets")
    op.drop_constraint("fk_assets_workspace_id_workspaces", "assets", type_="foreignkey")
    op.drop_column("assets", "workspace_id")

    op.drop_index(op.f("ix_workspace_memberships_workspace_id"), table_name="workspace_memberships")
    op.drop_index(op.f("ix_workspace_memberships_user_id"), table_name="workspace_memberships")
    op.drop_table("workspace_memberships")

    op.drop_index(op.f("ix_workspaces_kind"), table_name="workspaces")
    op.drop_index(op.f("ix_workspaces_created_by_id"), table_name="workspaces")
    op.drop_table("workspaces")

    op.execute("DROP TYPE IF EXISTS workspace_membership_role")
    op.execute("DROP TYPE IF EXISTS workspace_kind")
