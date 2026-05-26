"""Generate upcoming wound monitoring schedule rows (Phase B stub)."""
from __future__ import annotations

import uuid
from datetime import date, timedelta

from models import SessionSchedule, db


def seed_wound_schedules_for_site(patient_id: str, wound_site_id: str, weeks: int = 4) -> None:
    """Append UPCOMING SessionSchedule rows for a wound site (weekly)."""
    today = date.today()
    for i in range(weeks):
        d = today + timedelta(days=7 * i)
        ds = d.isoformat()
        db.session.add(
            SessionSchedule(
                id=str(uuid.uuid4()),
                patient_id=patient_id,
                wound_site_id=wound_site_id,
                session_type="WOUND_MONITOR",
                scheduled_date=ds,
                due_by_date=ds,
                status="UPCOMING",
            )
        )


def seed_skin_and_contributing_schedules_if_needed(patient_id: str) -> None:
    """Phase C2/C3: add monthly skin + quarterly contributing-factor schedule rows once."""
    if SessionSchedule.query.filter_by(patient_id=patient_id, session_type="SKIN_MONITOR").first():
        return
    today = date.today()
    # Monthly skin assessments: include a near-term slot plus ~30/60/90 day follow-ups (Section 6 P17).
    for days in (0, 30, 60, 90):
        d = today + timedelta(days=days)
        ds = d.isoformat()
        db.session.add(
            SessionSchedule(
                id=str(uuid.uuid4()),
                patient_id=patient_id,
                wound_site_id=None,
                session_type="SKIN_MONITOR",
                scheduled_date=ds,
                due_by_date=ds,
                status="UPCOMING",
            )
        )
    for qdays in (90, 180, 270, 360):
        d = today + timedelta(days=qdays)
        ds = d.isoformat()
        db.session.add(
            SessionSchedule(
                id=str(uuid.uuid4()),
                patient_id=patient_id,
                wound_site_id=None,
                session_type="CONTRIBUTING_QUARTERLY",
                scheduled_date=ds,
                due_by_date=ds,
                status="UPCOMING",
            )
        )
