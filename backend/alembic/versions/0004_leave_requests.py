"""leave requests

Revision ID: 0004
Revises: 0003
Create Date: 2026-11-12
"""
import sqlalchemy as sa
from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "leave_requests",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("employee_id", sa.Integer(), nullable=False),
        sa.Column("leave_type", sa.String(length=20), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        sa.Column("days", sa.Integer(), nullable=False),
        sa.Column("reason", sa.String(length=500), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="pending"),
        sa.Column("reviewed_by_id", sa.Integer(), nullable=True),
        sa.Column("review_comment", sa.String(length=500), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
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
        sa.CheckConstraint("end_date >= start_date", name=op.f("ck_leave_requests_valid_date_range")),
        sa.CheckConstraint("days >= 1", name=op.f("ck_leave_requests_positive_days")),
        sa.ForeignKeyConstraint(
            ["employee_id"],
            ["employees.id"],
            name=op.f("fk_leave_requests_employee_id_employees"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["reviewed_by_id"],
            ["users.id"],
            name=op.f("fk_leave_requests_reviewed_by_id_users"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_leave_requests")),
    )
    op.create_index(op.f("ix_leave_requests_employee_id"), "leave_requests", ["employee_id"])
    op.create_index(op.f("ix_leave_requests_status"), "leave_requests", ["status"])


def downgrade() -> None:
    op.drop_index(op.f("ix_leave_requests_status"), table_name="leave_requests")
    op.drop_index(op.f("ix_leave_requests_employee_id"), table_name="leave_requests")
    op.drop_table("leave_requests")

