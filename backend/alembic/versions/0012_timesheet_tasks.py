"""Store task rows on daily timesheets."""

import sqlalchemy as sa
from alembic import op

revision = "0012"
down_revision = "0011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("timesheet_entries", sa.Column("tasks", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("timesheet_entries", "tasks")
