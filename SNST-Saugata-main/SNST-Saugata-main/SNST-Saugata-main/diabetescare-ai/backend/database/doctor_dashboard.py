import uuid
from sqlalchemy import case, desc
from sqlalchemy.orm import Session

from backend.database.models import (
    AIResult, Alert, DoctorPatientAssignment, MonitoringSession, Patient, WoundSite
)

ALERT_ORDER = case(
    (Alert.alert_level == "RED", 0),
    (Alert.alert_level == "AMBER", 1),
    (Alert.alert_level == "GREEN", 2),
    else_=3,
)


def patient_ids_for_doctor(db: Session, doctor_id: str) -> set[str]:
    try:
        doc_uuid = uuid.UUID(str(doctor_id))
    except ValueError:
        return set()

    assigned = {
        str(r.patient_id)
        for r in db.query(DoctorPatientAssignment).filter_by(
            doctor_id=doc_uuid
        ).all()
    }
    if assigned:
        return assigned
        
    # Fallback to patients with open alerts
    return {str(r.patient_id) for r in db.query(Alert).filter(Alert.resolved_at.is_(None)).all()}


def urgency_rank(level: str | None) -> int:
    m = {"RED": 0, "AMBER": 1, "GREEN": 2}
    return m.get((level or "").upper(), 9)


def build_patient_list(db: Session, doctor_id: str) -> list[dict]:
    pids = patient_ids_for_doctor(db, doctor_id)
    if not pids:
        return []

    pid_uuids = []
    for pid in pids:
        try:
            pid_uuids.append(uuid.UUID(pid))
        except ValueError:
            continue

    patients = db.query(Patient).filter(Patient.patient_id.in_(pid_uuids)).all()
    out = []
    for p in patients:
        open_alerts = (
            db.query(Alert)
            .filter_by(patient_id=p.patient_id)
            .filter(Alert.resolved_at.is_(None))
            .order_by(ALERT_ORDER, desc(Alert.generated_at))
            .all()
        )
        max_level = open_alerts[0].alert_level if open_alerts else "GREEN"
        
        latest_session = (
            db.query(MonitoringSession)
            .filter_by(patient_id=p.patient_id, session_type="WOUND")
            .order_by(desc(MonitoringSession.submitted_at))
            .first()
        )
        
        latest_ai = None
        if latest_session:
            latest_ai = db.query(AIResult).filter_by(session_id=latest_session.session_id).first()
            
        out.append(
            {
                "patient_id": str(p.patient_id),
                "name": p.name,
                "phone": p.phone,
                "age": p.age,
                "village": p.village,
                "urgency": max_level,
                "open_alert_count": len(open_alerts),
                "latest_wound_area_cm2": float(latest_ai.wound_area_cm2 or 0) if latest_ai else None,
                "latest_wagner_grade": int(latest_ai.wagner_grade or 0) if latest_ai else None,
                "latest_session_id": str(latest_session.session_id) if latest_session else None,
            }
        )
    out.sort(key=lambda x: (urgency_rank(x["urgency"]), -(x["open_alert_count"] or 0)))
    return out


def wound_area_chart(db: Session, patient_id: str, wound_site_id: str | None = None) -> dict:
    try:
        p_uuid = uuid.UUID(str(patient_id))
    except ValueError:
        return {"labels": [], "areas": [], "wagner": [], "points": []}

    q = (
        db.query(MonitoringSession)
        .filter_by(patient_id=p_uuid, session_type="WOUND")
        .filter(MonitoringSession.submitted_at.isnot(None))
        .order_by(MonitoringSession.submitted_at.asc())
    )
    
    if wound_site_id:
        try:
            ws_uuid = uuid.UUID(str(wound_site_id))
            q = q.filter_by(wound_site_id=ws_uuid)
        except ValueError:
            pass
            
    sessions = q.limit(24).all()
    labels = []
    areas = []
    wagner = []
    points = []
    
    for ms in sessions:
        air = db.query(AIResult).filter_by(session_id=ms.session_id).first()
        if not air:
            continue
            
        label = ms.submitted_at.date().isoformat() if ms.submitted_at else ""
        labels.append(label)
        areas.append(float(air.wound_area_cm2 or 0))
        wagner.append(int(air.wagner_grade or 0))
        points.append(
            {
                "session_id": str(ms.session_id),
                "date": label,
                "area_cm2": float(air.wound_area_cm2 or 0),
                "wagner_grade": int(air.wagner_grade or 0),
                "alert_level": air.alert_level,
            }
        )
        
    return {"labels": labels, "areas": areas, "wagner": wagner, "points": points}
