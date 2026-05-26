"""Seed app_config (Phase A). Safe to call repeatedly."""
from datetime import datetime, timezone

from models import AppConfig, Doctor, db


def _utcnow():
    return datetime.now(timezone.utc)


def ensure_phase_a_seed():
    defaults = [
        ("min_app_version", "1.0.0", "Force update below this semver"),
        ("ai_confidence_threshold", "0.65", "Gemini fallback threshold"),
        ("max_photo_size_kb", "1200", "Client compress target"),
        ("alert_escalation_hours", "4", "RED alert escalation"),
        ("session_overdue_after_days", "2", "Overdue window"),
    ]
    for key, val, desc in defaults:
        row = AppConfig.query.filter_by(config_key=key).first()
        if row is None:
            db.session.add(
                AppConfig(config_key=key, value=val, description=desc, updated_at=_utcnow())
            )

    db.session.commit()

    try:
        for d in Doctor.query.all():
            if not d.consultation_phone:
                suffix = (d.nmc_number or "0000")[-4:]
                d.consultation_phone = f"+91-9800{suffix}"
        db.session.commit()
    except Exception:
        db.session.rollback()
