"""add avatar_url to employees table

Revision ID: 0007
Revises: 0006
Create Date: 2026-11-16
"""
import sqlalchemy as sa
from alembic import op

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("employees", sa.Column("avatar_url", sa.String(length=500), nullable=True))


def downgrade() -> None:
    op.drop_column("employees", "avatar_url")

