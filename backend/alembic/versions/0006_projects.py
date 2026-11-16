"""create projects table and seed default projects

Revision ID: 0006
Revises: 0005
Create Date: 2026-11-13
"""
import sqlalchemy as sa
from alembic import op

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    projects_table = op.create_table(
        "projects",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("code", sa.String(length=30), nullable=True),
        sa.Column("client", sa.String(length=150), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="Active"),
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
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name", name="uq_projects_name"),
        sa.UniqueConstraint("code", name="uq_projects_code"),
    )
    op.create_index("ix_projects_name", "projects", ["name"])
    op.create_index("ix_projects_status", "projects", ["status"])

    # Seed initial projects
    op.bulk_insert(
        projects_table,
        [
            {"name": "Maarga AI", "code": "MAI", "client": "Maarga", "status": "Active"},
            {"name": "Maarga AI & Elder Care", "code": "MAI-EC", "client": "Maarga", "status": "Active"},
            {"name": "MaargaAI/CRM-Tool", "code": "CRM", "client": "Maarga", "status": "Active"},
            {"name": "Nemilink Portal", "code": "NL-PORTAL", "client": "Nemilink Technologies", "status": "Active"},
            {"name": "Internal Tool", "code": "INT", "client": "Internal", "status": "Active"},
        ],
    )


def downgrade() -> None:
    op.drop_index("ix_projects_status", table_name="projects")
    op.drop_index("ix_projects_name", table_name="projects")
    op.drop_table("projects")

