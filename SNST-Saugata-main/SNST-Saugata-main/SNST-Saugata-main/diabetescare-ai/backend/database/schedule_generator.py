import uuid
from datetime import date, timedelta, datetime
from sqlalchemy.orm import Session

from backend.database.models import SessionSchedule

def seed_wound_schedules_for_site(db: Session, patient_id: str, wound_site_id: str, weeks: int = 4) -> None:
    """Append UPCOMING SessionSchedule rows for a wound site (weekly)."""
    today = date.today()
    for i in range(weeks):
        d = today + timedelta(days=7 * i)
        scheduled_datetime = datetime(d.year, d.month, d.day)
        db.add(
            SessionSchedule(
                schedule_id=uuid.uuid4(),
                patient_id=uuid.UUID(patient_id) if isinstance(patient_id, str) else patient_id,
                wound_site_id=uuid.UUID(wound_site_id) if isinstance(wound_site_id, str) else wound_site_id,
                session_type="WOUND_MONITOR",
                scheduled_date=scheduled_datetime,
                due_by_date=d.isoformat(),
                status="UPCOMING",
            )
        )


def seed_skin_and_contributing_schedules_if_needed(db: Session, patient_id: str) -> None:
    """Phase C2/C3: add monthly skin + quarterly contributing-factor schedule rows once."""
    pat_uuid = uuid.UUID(patient_id) if isinstance(patient_id, str) else patient_id
    if db.query(SessionSchedule).filter_by(patient_id=pat_uuid, session_type="SKIN_MONITOR").first():
        return
    today = date.today()
    # Monthly skin assessments: include a near-term slot plus ~30/60/90 day follow-ups (Section 6 P17).
    for days in (0, 30, 60, 90):
        d = today + timedelta(days=days)
        scheduled_datetime = datetime(d.year, d.month, d.day)
        db.add(
            SessionSchedule(
                schedule_id=uuid.uuid4(),
                patient_id=pat_uuid,
                wound_site_id=None,
                session_type="SKIN_MONITOR",
                scheduled_date=scheduled_datetime,
                due_by_date=d.isoformat(),
                status="UPCOMING",
            )
        )
    for qdays in (90, 180, 270, 360):
        d = today + timedelta(days=qdays)
        scheduled_datetime = datetime(d.year, d.month, d.day)
        db.add(
            SessionSchedule(
                schedule_id=uuid.uuid4(),
                patient_id=pat_uuid,
                wound_site_id=None,
                session_type="CONTRIBUTING_QUARTERLY",
                scheduled_date=scheduled_datetime,
                due_by_date=d.isoformat(),
                status="UPCOMING",
            )
        )
