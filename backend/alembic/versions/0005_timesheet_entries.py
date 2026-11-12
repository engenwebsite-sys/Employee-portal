"""timesheet entries

Revision ID: 0005
Revises: 0004
Create Date: 2026-11-12
"""
import sqlalchemy as sa
from alembic import op

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "timesheet_entries",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("employee_id", sa.Integer(), nullable=False),
        sa.Column("work_date", sa.Date(), nullable=False),
        sa.Column("login_time", sa.String(length=10), nullable=True),
        sa.Column("logout_time", sa.String(length=10), nullable=True),
        sa.Column("project", sa.String(length=150), nullable=True),
        sa.Column("task_description", sa.Text(), nullable=False, server_default=""),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="In Progress"),
        sa.Column("remarks", sa.Text(), nullable=True),
        sa.Column("day_type", sa.String(length=30), nullable=False, server_default="Working Day"),
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
        sa.ForeignKeyConstraint(
            ["employee_id"],
            ["employees.id"],
            name=op.f("fk_timesheet_entries_employee_id_employees"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_timesheet_entries")),
        sa.UniqueConstraint("employee_id", "work_date", name="uq_timesheet_emp_date"),
    )
    op.create_index(
        op.f("ix_timesheet_entries_employee_id"), "timesheet_entries", ["employee_id"]
    )
    op.create_index(op.f("ix_timesheet_entries_work_date"), "timesheet_entries", ["work_date"])


def downgrade() -> None:
    op.drop_index(op.f("ix_timesheet_entries_work_date"), table_name="timesheet_entries")
    op.drop_index(op.f("ix_timesheet_entries_employee_id"), table_name="timesheet_entries")
    op.drop_table("timesheet_entries")

