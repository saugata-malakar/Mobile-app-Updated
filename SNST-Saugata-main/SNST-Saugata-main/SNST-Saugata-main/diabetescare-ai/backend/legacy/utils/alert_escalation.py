"""Phase C1: escalation scan for stale unacknowledged RED alerts (Section 7 Phase C)."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from models import Alert, AppConfig, db

from utils.notify_stub import notify_escalation


def _escalation_hours_default() -> int:
    row = AppConfig.query.filter_by(config_key="alert_escalation_hours").first()
    if not row or not row.value:
        return 4
    try:
        return max(1, int(str(row.value).strip()))
    except (TypeError, ValueError):
        return 4


def run_red_alert_escalation(hours: int | None = None) -> int:
    """
    Find RED alerts that are still unresolved, older than `hours`, and not yet escalated.
    Sends one escalation notification per alert and records escalation_at / escalation_level.
    """
    h = hours if hours is not None else _escalation_hours_default()
    cutoff = datetime.now(timezone.utc) - timedelta(hours=h)
    rows = (
        Alert.query.filter(
            Alert.alert_level == "RED",
            Alert.resolved_at.is_(None),
            Alert.generated_at < cutoff,
            Alert.escalation_at.is_(None),
        )
        .order_by(Alert.generated_at.asc())
        .all()
    )
    now = datetime.now(timezone.utc)
    n = 0
    for a in rows:
        notify_escalation(a.id, a.patient_id)
        a.escalation_at = now
        a.escalation_level = max(int(a.escalation_level or 0), 1)
        db.session.add(a)
        n += 1
    if n:
        db.session.commit()
    return n
