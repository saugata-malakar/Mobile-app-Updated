#!/usr/bin/env python3
"""
One-shot RED alert escalation (Phase C1). Intended for OS cron, e.g. every 4 hours:

  cd backend && source venv/bin/activate && python3 run_escalation_cron.py

Uses AppConfig `alert_escalation_hours` (default 4). For HTTP-triggered runs use
POST /api/v1/admin/jobs/escalate-red-alerts instead.
"""
from __future__ import annotations

from app import app
from utils.alert_escalation import run_red_alert_escalation


def main() -> None:
    with app.app_context():
        n = run_red_alert_escalation()
        print(f"stale_red_alerts_escalated={n}")


if __name__ == "__main__":
    main()
