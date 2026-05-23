"""Helpers for doctor web dashboard queries."""
from __future__ import annotations

from sqlalchemy import case, func

from models import (
    AiResult,
    Alert,
    DoctorPatientAssignment,
    MonitoringSession,
    Patient,
    TeleconsultRequest,
    WoundSite,
)

ALERT_ORDER = case(
    (Alert.alert_level == "RED", 0),
    (Alert.alert_level == "AMBER", 1),
    (Alert.alert_level == "GREEN", 2),
    else_=3,
)


def patient_ids_for_doctor(doctor_id: str) -> set[str]:
    assigned = {
        r.patient_id
        for r in DoctorPatientAssignment.query.filter_by(
            doctor_id=doctor_id, is_active=True
        ).all()
    }
    if assigned:
        return assigned
    return {r.patient_id for r in Alert.query.filter(Alert.resolved_at.is_(None)).all()}


def urgency_rank(level: str | None) -> int:
    m = {"RED": 0, "AMBER": 1, "GREEN": 2}
    return m.get((level or "").upper(), 9)


def build_patient_list(doctor_id: str) -> list[dict]:
    pids = patient_ids_for_doctor(doctor_id)
    if not pids:
        return []

    patients = Patient.query.filter(Patient.id.in_(list(pids))).all()
    out = []
    for p in patients:
        open_alerts = (
            Alert.query.filter_by(patient_id=p.id)
            .filter(Alert.resolved_at.is_(None))
            .order_by(ALERT_ORDER, Alert.generated_at.desc())
            .all()
        )
        max_level = open_alerts[0].alert_level if open_alerts else "GREEN"
        latest_session = (
            MonitoringSession.query.filter_by(patient_id=p.id, track="WOUND")
            .order_by(MonitoringSession.submitted_at.desc())
            .first()
        )
        latest_ai = None
        if latest_session:
            latest_ai = AiResult.query.filter_by(session_id=latest_session.id).first()
        out.append(
            {
                "patient_id": p.id,
                "name": p.name,
                "phone": p.phone,
                "age": p.age,
                "village": p.village,
                "urgency": max_level,
                "open_alert_count": len(open_alerts),
                "latest_wound_area_cm2": float(latest_ai.wound_area_cm2 or 0)
                if latest_ai
                else None,
                "latest_wagner_grade": int(latest_ai.wagner_grade or 0) if latest_ai else None,
                "latest_session_id": latest_session.id if latest_session else None,
            }
        )
    out.sort(key=lambda x: (urgency_rank(x["urgency"]), -(x["open_alert_count"] or 0)))
    return out


def wound_area_chart(patient_id: str, wound_site_id: str | None = None) -> dict:
    q = (
        MonitoringSession.query.filter_by(patient_id=patient_id, track="WOUND")
        .filter(MonitoringSession.submitted_at.isnot(None))
        .order_by(MonitoringSession.submitted_at.asc())
    )
    if wound_site_id:
        q = q.filter_by(wound_site_id=wound_site_id)
    sessions = q.limit(24).all()
    labels = []
    areas = []
    wagner = []
    points = []
    for ms in sessions:
        air = AiResult.query.filter_by(session_id=ms.id).first()
        if not air:
            continue
        label = ms.submitted_at.date().isoformat() if ms.submitted_at else ""
        labels.append(label)
        areas.append(float(air.wound_area_cm2 or 0))
        wagner.append(int(air.wagner_grade or 0))
        points.append(
            {
                "session_id": ms.id,
                "date": label,
                "area_cm2": float(air.wound_area_cm2 or 0),
                "wagner_grade": int(air.wagner_grade or 0),
                "alert_level": air.alert_level,
            }
        )
    return {"labels": labels, "areas": areas, "wagner": wagner, "points": points}
