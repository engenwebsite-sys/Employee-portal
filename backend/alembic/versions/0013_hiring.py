"""Add HR hiring openings, applications, interviews and notification history."""

import sqlalchemy as sa
from alembic import op

revision = "0013"
down_revision = "0012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "hiring_openings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("title", sa.String(150), nullable=False),
        sa.Column("division", sa.String(80), nullable=False),
        sa.Column("vacancies", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("target_joining_date", sa.Date()),
        sa.Column("rounds", sa.JSON(), nullable=False),
        sa.Column("hr_owner_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("manager_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
    )
    op.create_table(
        "hiring_candidates",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(150), nullable=False),
        sa.Column("email", sa.String(255), nullable=False, unique=True),
        sa.Column("phone", sa.String(40)),
        sa.Column("resume_url", sa.Text()),
    )
    op.create_table(
        "hiring_applications",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("opening_id", sa.Integer(), sa.ForeignKey("hiring_openings.id"), nullable=False, index=True),
        sa.Column("candidate_id", sa.Integer(), sa.ForeignKey("hiring_candidates.id"), nullable=False),
        sa.Column("stage", sa.String(20), nullable=False),
        sa.Column("source", sa.String(120)),
        sa.Column("experience", sa.String(120)),
        sa.Column("notice_period", sa.String(80)),
        sa.Column("expected_ctc", sa.String(80)),
        sa.Column("next_action", sa.String(250)),
        sa.Column("notes", sa.Text()),
        sa.UniqueConstraint("opening_id", "candidate_id", name="uq_hiring_application_candidate"),
    )
    op.create_table(
        "hiring_interviews",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("application_id", sa.Integer(), sa.ForeignKey("hiring_applications.id"), nullable=False, index=True),
        sa.Column("round_name", sa.String(100), nullable=False),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("meeting_url", sa.Text()),
        sa.Column("attendance", sa.String(20), nullable=False),
        sa.Column("result", sa.String(20), nullable=False),
        sa.Column("feedback", sa.Text()),
        sa.UniqueConstraint("application_id", "round_name", name="uq_hiring_interview_round"),
    )
    op.create_table(
        "hiring_notifications",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("interview_id", sa.Integer(), sa.ForeignKey("hiring_interviews.id"), nullable=False, index=True),
        sa.Column("event", sa.String(20), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("recipients", sa.JSON(), nullable=False),
        sa.Column("remaining_recipients", sa.JSON()),
        sa.Column("reply_to", sa.String(255), nullable=False),
        sa.Column("subject", sa.String(500), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("error", sa.String(250)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )


def downgrade() -> None:
    for table in ("hiring_notifications", "hiring_interviews", "hiring_applications", "hiring_candidates", "hiring_openings"):
        op.drop_table(table)
