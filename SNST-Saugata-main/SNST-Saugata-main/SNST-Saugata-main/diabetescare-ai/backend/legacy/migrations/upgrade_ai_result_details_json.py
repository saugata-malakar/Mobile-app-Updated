"""Add ai_results.details_json for Phase C2 skin stub payloads (SQLite, idempotent)."""
from __future__ import annotations

from sqlalchemy import inspect, text

from app import app, db


def upgrade() -> list[str]:
    if db.engine.dialect.name != "sqlite":
        raise RuntimeError("This helper targets SQLite; use your own migration for other engines.")
    insp = inspect(db.engine)
    cols = {c["name"] for c in insp.get_columns("ai_results")}
    ran: list[str] = []
    if "details_json" not in cols:
        sql = "ALTER TABLE ai_results ADD COLUMN details_json TEXT"
        db.session.execute(text(sql))
        ran.append(sql)
        db.session.commit()
    return ran


def main() -> None:
    with app.app_context():
        ran = upgrade()
        for s in ran:
            print("executed:", s)
        if not ran:
            print("ai_results.details_json already present.")


if __name__ == "__main__":
    main()
