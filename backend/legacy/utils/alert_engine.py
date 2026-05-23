"""Phase C1 — derive patient alerts from stored AI results (Section 4 alerts + Section 5.7)."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from models import AiResult, Alert, MonitoringSession, Patient, db
from utils.notify_stub import notify_new_alert

# Section 4 — alerts.alert_type CHECK list (subset used by AI pipeline; extend as models grow).
ALLOWED_ALERT_TYPES = frozenset(
    {
        "WOUND_AREA_INCREASING",
        "INFECTION_DETECTED",
        "GRADE_INCREASE",
        "HEALING_STALLED",
        "CELLULITIS_SPREADING",
        "ESCHAR_DETECTED",
        "EYE_URGENT",
        "PALLOR_SEVERE",
        "OVERDUE_SUBMISSION",
        "QUALITY_REJECTED",
        "SUBSCRIPTION_LAPSED",
    }
)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _infer_alert(
    session_type: str,
    alert_level: str,
    wagner_grade: int | None,
) -> tuple[str, str, str, str] | None:
    """
    Returns (alert_type, message_patient_en, message_patient_bn, message_doctor_en)
    or None if no patient-facing alert should be created.
    """
    st = (session_type or "").upper()
    lvl = (alert_level or "").upper()
    if lvl not in ("RED", "YELLOW"):
        return None
    wg = int(wagner_grade or 0)

    if st == "EYE_TRIAGE" and lvl == "RED":
        return (
            "EYE_URGENT",
            "Eye triage: possible urgent eye problem. Seek same-day eye care or emergency care if pain or vision loss worsens.",
            "\u099A\u09CB\u0996: \u0985\u09A4\u09BF\u09B6\u09CD\u09B0\u09C1\u09A4 \u09B8\u09AE\u09B8\u09CD\u09AF\u09BE\u0964 \u0985\u09A4\u09BF\u09B6\u09CD\u09B0\u09C1\u09A4 \u099A\u09BF\u0995\u09BF\u09CE\u09B8\u09BE \u09A8\u09BF\u09A8\u0964",
            "External eye triage RED — rule out acute glaucoma / corneal ulcer; advise urgent ophthalmology.",
        )
    if st == "PALLOR_TRIAGE" and lvl in ("RED", "YELLOW"):
        return (
            "PALLOR_SEVERE",
            "Pallor check suggests possible anaemia risk affecting healing. Follow up with your clinician.",
            "\u09AA\u09BE\u09B2\u09B0 \u09AA\u09B0\u09C0\u0995\u09CD\u09B7\u09BE: \u09B0\u0995\u09CD\u09A4\u09B6\u09C2\u09A8\u09CD\u09AF\u09A4\u09BE\u09B0 \u09B8\u0982\u0995\u09C7\u09A4\u0964 \u099A\u09BF\u0995\u09BF\u09CE\u09B8\u0995\u09C7\u09B0 \u09B8\u09BE\u09A5\u09C7 \u09AF\u09CB\u0997\u09BE\u09AF\u09CB\u0997 \u0995\u09B0\u09C1\u09A8\u0964",
            "Conjunctival pallor triage non-green — consider Hb / wound-healing risk counselling.",
        )
    if st == "SKIN_MONITOR":
        if lvl == "RED":
            return (
                "CELLULITIS_SPREADING",
                "Skin monitoring: possible spreading infection near the foot. Seek clinical review if redness, fever, or pain worsen.",
                "\u09A4\u09CD\u09AC\u0995 \u09A8\u09BF\u09B0\u09CD\u09A3\u09AF\u09BC: \u09AA\u09BE\u09DF\u09C7\u09B0 \u0995\u09BE\u099B\u09C7 \u09B8\u0982\u0995\u09CD\u09B0\u09AE\u09A3 \u09B8\u09AE\u09CD\u09AD\u09AC\u09A8\u09BE\u0964 \u0985\u09B8\u09CD\u09AC\u09B8\u09CD\u09A5 \u09B9\u09B2\u09C7 \u099A\u09BF\u0995\u09BF\u09CE\u09B8\u0995\u09C7\u09B0 \u09B8\u09BE\u09A5\u09C7 \u09AF\u09CB\u0997\u09BE\u09AF\u09CB\u0997 \u0995\u09B0\u09C1\u09A8\u0964",
                "Periwound skin RED alert — document spreading cellulitis risk; wound contamination context.",
            )
        if lvl == "YELLOW":
            return (
                "HEALING_STALLED",
                "Skin monitoring: some findings need routine follow-up. Keep the area clean and monitor for change.",
                "\u09A4\u09CD\u09AC\u0995 \u09A8\u09BF\u09B0\u09CD\u09A3\u09AF\u09BC: \u0995\u09BF\u099B\u09C1 \u09B8\u09CD\u09A5\u09BE\u09A8\u09C0\u09AF\u09BC \u09AF\u09CB\u0997\u09AF\u09CB\u0997\u0964 \u09AA\u09B0\u09BF\u09B7\u09CD\u0995\u09BE\u09B0 \u09B0\u09BE\u0996\u09C1\u09A8\u0964",
                "Periwound skin non-green — routine wound-risk counselling.",
            )
        return None

    # Wound monitoring (WOUND_MONITOR and legacy types)
    if st in ("WOUND_MONITOR", "WOUND_MONITORING", "WOUND") or "WOUND" in st:
        if lvl == "RED":
            if wg >= 2:
                return (
                    "GRADE_INCREASE",
                    "Wound check: higher Wagner grade or serious change detected. Contact your care team urgently.",
                    "\u0995\u09CD\u09B7\u09A4 \u09AA\u09B0\u09C0\u0995\u09CD\u09B7\u09BE: Wagner \u09B6\u09CD\u09CD\u09B0\u09C7\u09A3\u09C0 \u09AC\u09C3\u09A6\u09CD\u09A7\u09BF \u09AC\u09BE \u0997\u09C1\u09B0\u09C1\u09A4\u09CD\u09AC\u09AA\u09C2\u09B0\u09CD\u09A3 \u09AA\u09B0\u09BF\u09AC\u09B0\u09CD\u09A4\u09A8\u0964 \u0985\u09A4\u09BF\u09B6\u09CD\u09B0\u09C1\u09A4 \u09AF\u09CB\u0997\u09BE\u09AF\u09CB\u0997\u0964",
                    f"Wound AI RED — Wagner grade {wg}; urgent DFU pathway review.",
                )
            return (
                "INFECTION_DETECTED",
                "Wound check: possible infection or rapid change. Seek prompt clinical review.",
                "\u0995\u09CD\u09B7\u09A4 \u09AA\u09B0\u09C0\u0995\u09CD\u09B7\u09BE: \u09B8\u09CD\u09AE\u09CD\u09AC\u09AD\u09AC\u09A8\u09C7\u09B0 \u09B8\u0982\u0995\u09C7\u09A4\u0964 \u09A6\u09CD\u09B0\u09C1\u09A4 \u099A\u09BF\u0995\u09BF\u09CE\u09B8\u09BE \u09A8\u09BF\u09A8\u0964",
                "Wound AI RED — infection / acute change suspected.",
            )
        if lvl == "YELLOW":
            return (
                "HEALING_STALLED",
                "Wound check: healing may be slower than ideal. Continue care plan and review with your clinician.",
                "\u0995\u09CD\u09B7\u09A4 \u09AA\u09B0\u09C0\u0995\u09CD\u09B7\u09BE: \u09B8\u09C1\u09B8\u09CD\u09A5 \u09AE\u09A8\u09CD\u09A5\u09C7\u09B0 \u099A\u09C7\u09DF\u09C7 \u09A7\u09BF\u09B0\u09C7 \u099A\u09B2\u09C7\u0964 \u09A5\u09C7\u09B0\u09BE\u09AA\u09BF \u099A\u09BE\u09B2\u09BF\u09DF\u09C7 \u09B0\u09BE\u0996\u09C1\u09A8\u0964",
                "Wound AI YELLOW — monitor trajectory; consider earlier follow-up.",
            )

    # Generic fallback for other session types with RED/YELLOW
    if lvl == "RED":
        return (
            "INFECTION_DETECTED",
            "Monitoring session flagged urgent findings. Please contact your clinician.",
            "\u09A8\u09BF\u09B0\u09CD\u09A3\u09AF\u09BC: \u0985\u09A4\u09BF\u09B6\u09CD\u09B0\u09C1\u09A4 \u09AB\u09B2\u0964 \u099A\u09BF\u0995\u09BF\u09CE\u09B8\u0995\u09C7 \u09AF\u09CB\u0997\u09BE\u09AF\u09CB\u0997 \u0995\u09B0\u09C1\u09A8\u0964",
            "Monitoring RED — manual review recommended.",
        )
    return (
        "HEALING_STALLED",
        "Monitoring session needs routine follow-up.",
        "\u09A8\u09BF\u09B0\u09CD\u09A3\u09AF\u09BC: \u09A8\u09BF\u09AF\u09BC\u09AE\u09BF\u09A4 \u09AF\u09CB\u0997\u09AF\u09CB\u0997\u0964",
        "Monitoring YELLOW — routine follow-up.",
    )


def generate_alerts_after_ai_result(patient: Patient, ms: MonitoringSession, air: AiResult) -> str | None:
    """
    Persist one alert row when AI indicates YELLOW or RED (GREEN is informational only on AiResult).
    Returns new alert id or None.
    """
    inferred = _infer_alert(ms.session_type or "", air.alert_level or "", air.wagner_grade)
    if inferred is None:
        return None
    alert_type, msg_en, msg_bn, msg_doc = inferred
    if alert_type not in ALLOWED_ALERT_TYPES:
        alert_type = "INFECTION_DETECTED"

    al = Alert(
        id=str(uuid.uuid4()),
        session_id=ms.id,
        patient_id=patient.id,
        wound_site_id=ms.wound_site_id,
        alert_level=air.alert_level,
        alert_type=alert_type,
        message_patient_en=msg_en,
        message_patient_bn=msg_bn,
        message_doctor_en=msg_doc,
        generated_at=_utcnow(),
    )
    db.session.add(al)
    notify_new_alert(air.alert_level, patient.id, msg_en)
    return al.id
