"""employees and departments

Revision ID: 0003
Revises: 0002
Create Date: 2026-11-12
"""
import sqlalchemy as sa
from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "departments",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_departments")),
        sa.UniqueConstraint("name", name=op.f("uq_departments_name")),
    )
    op.create_table(
        "employees",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("employee_code", sa.String(length=20), nullable=False),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("department_id", sa.Integer(), nullable=True),
        sa.Column("designation", sa.String(length=100), nullable=True),
        sa.Column("manager_id", sa.Integer(), nullable=True),
        sa.Column("joining_date", sa.Date(), nullable=False),
        sa.Column("probation_end_date", sa.Date(), nullable=False),
        sa.Column("phone", sa.String(length=20), nullable=True),
        sa.Column("emergency_contact", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("manager_id IS NULL OR manager_id <> id", name=op.f("ck_employees_not_own_manager")),
        sa.ForeignKeyConstraint(
            ["department_id"], ["departments.id"],
            name=op.f("fk_employees_department_id_departments"), ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["manager_id"], ["employees.id"],
            name=op.f("fk_employees_manager_id_employees"), ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"],
            name=op.f("fk_employees_user_id_users"), ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_employees")),
        sa.UniqueConstraint("employee_code", name=op.f("uq_employees_employee_code")),
        sa.UniqueConstraint("user_id", name=op.f("uq_employees_user_id")),
    )
    op.create_index(op.f("ix_employees_department_id"), "employees", ["department_id"])
    op.create_index(op.f("ix_employees_manager_id"), "employees", ["manager_id"])


def downgrade() -> None:
    op.drop_index(op.f("ix_employees_manager_id"), table_name="employees")
    op.drop_index(op.f("ix_employees_department_id"), table_name="employees")
    op.drop_table("employees")
    op.drop_table("departments")