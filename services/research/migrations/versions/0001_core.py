"""Create the initial identity and research data schema."""

from pathlib import Path

from alembic import op

revision = "0001_core"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Keep this immutable SQL in version control, shared by migration and PostgreSQL tests.
    root = Path(__file__).resolve().parents[4]
    sql = (root / "db/migrations/0001_core.sql").read_text()
    for statement in sql.split(";"):
        if statement.strip():
            op.execute(statement)


def downgrade() -> None:
    for table in (
        "usage_events",
        "extraction_cells",
        "extraction_columns",
        "extraction_tables",
        "chat_messages",
        "chats",
        "search_results",
        "searches",
        "collection_items",
        "collections",
        "library_items",
        "paper_chunks",
        "source_documents",
        "papers",
        "verification_token",
        "sessions",
        "accounts",
        "password_credentials",
        "users",
    ):
        op.drop_table(table)
    # Do not drop a database-wide extension that other applications may use.
