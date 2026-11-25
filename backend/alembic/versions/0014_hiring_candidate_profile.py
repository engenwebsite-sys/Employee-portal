"""Store extended candidate profiles independently of job openings."""

import sqlalchemy as sa
from alembic import op

revision = "0014"
down_revision = "0013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("hiring_candidates", sa.Column("profile", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("hiring_candidates", "profile")
