"""Add a reusable catalogue of hiring domains."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import insert

revision = "0016"
down_revision = "0015"
branch_labels = None
depends_on = None

INITIAL_DOMAINS = (
    "AI / ML",
    "Backend / Platform Engineering",
    "DevOps / SRE",
    "Frontend Development",
    "Hardware Engineering",
    "Healthcare IT / HIS",
    "Mobile Development",
    "Sales / Business Development",
    "SAP",
    "UI/UX Design",
)


def upgrade() -> None:
    domains = op.create_table("hiring_domains", sa.Column("name", sa.String(80), primary_key=True))
    op.create_index("uq_hiring_domains_name_ci", "hiring_domains", [sa.text("lower(name)")], unique=True)
    op.bulk_insert(domains, [{"name": name} for name in INITIAL_DOMAINS])

    openings = sa.table("hiring_openings", sa.column("domain", sa.String(80)))
    existing_names = sa.func.trim(openings.c.domain)
    op.execute(
        insert(domains)
        .from_select(["name"], sa.select(existing_names).where(existing_names != "").order_by(existing_names))
        .on_conflict_do_nothing()
    )


def downgrade() -> None:
    op.drop_table("hiring_domains")
