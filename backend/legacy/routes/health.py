from datetime import datetime, timezone

from flask import Blueprint
from sqlalchemy import text

from models import db
from utils.response_helper import success

health_bp = Blueprint("health", __name__)


@health_bp.get("/health")
def health():
    db_status = "disconnected"
    try:
        db.session.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception:
        db_status = "disconnected"

    overall = "ok" if db_status == "connected" else "error"
    payload = {
        "status": overall,
        "database": db_status,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "version": "1.0.0",
    }
    return success(payload, status=200)
