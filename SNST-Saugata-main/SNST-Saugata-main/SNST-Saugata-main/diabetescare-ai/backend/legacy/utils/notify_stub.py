"""Alert hooks → real notification dispatch (FCM + SMS when configured)."""
from __future__ import annotations

import logging

from utils.notification_dispatch import notify_alert_escalation, notify_patient_alert

logger = logging.getLogger(__name__)


def notify_new_alert(alert_level: str, patient_id: str, message: str) -> None:
    try:
        notify_patient_alert(patient_id, alert_level, message or "")
    except Exception:
        logger.exception("notify_new_alert failed patient=%s", patient_id)


def notify_escalation(alert_id: str, patient_id: str) -> None:
    try:
        notify_alert_escalation(patient_id, alert_id)
    except Exception:
        logger.exception("notify_escalation failed alert=%s patient=%s", alert_id, patient_id)
