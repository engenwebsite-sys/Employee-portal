"""Add project division.

Revision ID: 0009
Revises: 0008
"""

import sqlalchemy as sa
from alembic import op

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    columns = sa.inspect(op.get_bind()).get_columns("projects")
    if not any(column["name"] == "division" for column in columns):
        op.add_column("projects", sa.Column("division", sa.String(20), nullable=True))


def downgrade() -> None:
    op.drop_column("projects", "division")
