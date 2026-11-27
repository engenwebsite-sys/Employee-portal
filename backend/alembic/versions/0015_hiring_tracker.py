"""Add fields for the manual hiring tracker."""

import sqlalchemy as sa
from alembic import op

revision = "0015"
down_revision = "0014"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("hiring_openings", sa.Column("domain", sa.String(80)))
    op.add_column("hiring_openings", sa.Column("experience_required", sa.String(120)))
    op.add_column("hiring_openings", sa.Column("closing_date", sa.Date()))
    op.alter_column("hiring_candidates", "email", existing_type=sa.String(255), nullable=True)
    op.add_column("hiring_candidates", sa.Column("intake", sa.JSON()))
    op.add_column("hiring_applications", sa.Column("referred_by", sa.String(150)))
    op.add_column("hiring_applications", sa.Column("applied_on", sa.Date()))
    op.add_column("hiring_applications", sa.Column("decision", sa.String(30)))
    op.add_column("hiring_applications", sa.Column("decision_on", sa.Date()))


def downgrade() -> None:
    op.alter_column("hiring_candidates", "email", existing_type=sa.String(255), nullable=False)
    op.drop_column("hiring_applications", "decision_on")
    op.drop_column("hiring_applications", "decision")
    op.drop_column("hiring_applications", "applied_on")
    op.drop_column("hiring_applications", "referred_by")
    op.drop_column("hiring_candidates", "intake")
    op.drop_column("hiring_openings", "closing_date")
    op.drop_column("hiring_openings", "experience_required")
    op.drop_column("hiring_openings", "domain")
