"""create leave_adjustments table

Revision ID: 0008
Revises: 0007
Create Date: 2026-11-16
"""
import sqlalchemy as sa
from alembic import op

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "leave_adjustments",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("employee_id", sa.Integer(), nullable=False),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("leave_type", sa.String(length=20), nullable=False, server_default="casual"),
        sa.Column("days", sa.Integer(), nullable=False),
        sa.Column("reason", sa.String(length=500), nullable=False),
        sa.Column("adjusted_by_id", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["employee_id"], ["employees.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["adjusted_by_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_leave_adjustments_employee_id", "leave_adjustments", ["employee_id"], unique=False)
    op.create_index("ix_leave_adjustments_year", "leave_adjustments", ["year"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_leave_adjustments_year", table_name="leave_adjustments")
    op.drop_index("ix_leave_adjustments_employee_id", table_name="leave_adjustments")
    op.drop_table("leave_adjustments")
