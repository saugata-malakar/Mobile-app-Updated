"""Seed subscription_tiers and app_config (Phase A). Safe to call repeatedly."""
import uuid
from datetime import datetime, timezone

from models import AppConfig, Doctor, SubscriptionTier, db


def _utcnow():
    return datetime.now(timezone.utc)


def ensure_phase_a_seed():
    if SubscriptionTier.query.count() == 0:
        tiers = [
            ("BASIC", 299.0, 4, 1, 0, 0),
            ("STANDARD", 499.0, 4, 1, 1, 1),
            ("PREMIUM", 799.0, 8, 2, 1, 2),
        ]
        for name, price, w, s, cf, tc in tiers:
            db.session.add(
                SubscriptionTier(
                    id=str(uuid.uuid4()),
                    tier_name=name,
                    price_monthly_rs=price,
                    wound_sessions_per_month=w,
                    skin_sessions_per_month=s,
                    contributing_factor_sessions_per_quarter=cf,
                    teleconsult_included_per_month=tc,
                    features='[]',
                    is_active=True,
                    created_at=_utcnow(),
                )
            )

    defaults = [
        ("min_app_version", "1.0.0", "Force update below this semver"),
        ("ai_confidence_threshold", "0.65", "Gemini fallback threshold"),
        ("max_photo_size_kb", "1200", "Client compress target"),
        ("alert_escalation_hours", "4", "RED alert escalation"),
        ("trial_days", "3", "Commercial trial length"),
        ("grace_period_days", "7", "Payment grace"),
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
