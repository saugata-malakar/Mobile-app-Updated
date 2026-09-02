"""Seed wound sites + submitted monitoring sessions for dashboard charts (idempotent)."""
import uuid
from datetime import datetime, timedelta, timezone

from models import AiResult, MonitoringSession, Patient, WoundSite, db

# Demo patients from seed_dashboard_demo.py (phone -> chart profile)
WOUND_PROFILES = {
    "9876501001": {
        "foot_side": "LEFT",
        "location_on_foot": "PLANTAR",
        "areas": [12.5, 10.2, 8.1, 6.5],
        "wagner": [4, 3, 3, 2],
        "alert_levels": ["RED", "AMBER", "AMBER", "GREEN"],
        "confidence": 0.88,
    },
    "9876501002": {
        "foot_side": "RIGHT",
        "location_on_foot": "LATERAL",
        "areas": [5.0, 6.0, 7.5, 9.2],
        "wagner": [2, 2, 3, 3],
        "alert_levels": ["GREEN", "AMBER", "AMBER", "RED"],
        "confidence": 0.82,
    },
    "9876501003": {
        "foot_side": "LEFT",
        "location_on_foot": "HEEL",
        "areas": [4.0, 4.1, 3.9, 4.0],
        "wagner": [2, 2, 2, 2],
        "alert_levels": ["GREEN", "GREEN", "GREEN", "GREEN"],
        "confidence": 0.91,
    },
}


def ensure_dashboard_wound_sessions():
    """Add 4 weekly WOUND sessions per demo patient for doctor dashboard charts."""
    from migrations.upgrade_ai_result_details_json import upgrade as upgrade_ai_details
    from migrations.upgrade_patients_phase_a import upgrade_patients_phase_a

    upgrade_patients_phase_a()
    upgrade_ai_details()

    now = datetime.now(timezone.utc)
    sessions_added = 0

    for phone, profile in WOUND_PROFILES.items():
        patient = Patient.query.filter_by(phone=phone).first()
        if not patient:
            continue

        site = WoundSite.query.filter_by(patient_id=patient.id, status="ACTIVE").first()
        if not site:
            site = WoundSite(
                id=str(uuid.uuid4()),
                patient_id=patient.id,
                foot_side=profile["foot_side"],
                location_on_foot=profile["location_on_foot"],
                first_detected_date=(now - timedelta(days=28)).date().isoformat(),
                status="ACTIVE",
                initial_wagner_grade=profile["wagner"][0],
                current_wagner_grade=profile["wagner"][-1],
                is_primary_site=True,
            )
            db.session.add(site)
            db.session.flush()

        existing = (
            MonitoringSession.query.filter_by(
                patient_id=patient.id, wound_site_id=site.id, track="WOUND"
            )
            .filter(MonitoringSession.submitted_at.isnot(None))
            .count()
        )
        if existing >= len(profile["areas"]):
            site.current_wagner_grade = profile["wagner"][-1]
            site.last_session_at = now
            site.total_sessions = existing
            continue

        for i, (area, wagner, alert_level) in enumerate(
            zip(profile["areas"], profile["wagner"], profile["alert_levels"])
        ):
            submitted_at = now - timedelta(days=(len(profile["areas"]) - 1 - i) * 7)
            ms = MonitoringSession(
                id=str(uuid.uuid4()),
                patient_id=patient.id,
                wound_site_id=site.id,
                session_type="WOUND_MONITOR",
                track="WOUND",
                status="SUBMITTED",
                submitted_at=submitted_at,
                submission_method="SEED_DEMO",
                ai_processing_completed_at=submitted_at,
            )
            db.session.add(ms)
            db.session.flush()

            if not AiResult.query.filter_by(session_id=ms.id).first():
                db.session.add(
                    AiResult(
                        id=str(uuid.uuid4()),
                        session_id=ms.id,
                        model_version="demo-seed-v1",
                        processed_at=submitted_at,
                        processing_method="STUB",
                        overall_confidence=profile["confidence"],
                        wound_area_cm2=float(area),
                        wagner_grade=int(wagner),
                        alert_level=alert_level,
                    )
                )
                sessions_added += 1

        site.current_wagner_grade = profile["wagner"][-1]
        site.last_session_at = now
        site.total_sessions = (
            MonitoringSession.query.filter_by(
                patient_id=patient.id, wound_site_id=site.id, track="WOUND"
            )
            .filter(MonitoringSession.submitted_at.isnot(None))
            .count()
        )

    db.session.commit()
    print(f"Wound chart demo: {sessions_added} new session(s) with AI results.")
