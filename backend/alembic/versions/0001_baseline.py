"""baseline (no tables yet)

Revision ID: 0001
Revises:
Create Date: 2026-11-12
"""
from alembic import op  # noqa: F401

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Step 1 only sets up the migration system. Tables arrive in Step 2.
    pass


def downgrade() -> None:
    pass
