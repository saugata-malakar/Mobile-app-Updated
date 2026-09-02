#!/usr/bin/env python3
"""
Session schedule reminders — intended for daily cron at 08:00 IST.

  cd backend && source venv/bin/activate && PYTHONPATH=. python3 run_session_reminders_cron.py

By default runs only when the current clock in Asia/Kolkata is 08:00–08:59
(hour == 8). Use --force to run immediately (e.g. tests / manual).
"""
from __future__ import annotations

import argparse
from datetime import datetime

from zoneinfo import ZoneInfo

from app import app
from utils.session_reminder_job import run_session_reminders

IST = ZoneInfo("Asia/Kolkata")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--force", action="store_true", help="Run even outside 08:00 IST window")
    args = ap.parse_args()

    if not args.force:
        now = datetime.now(IST)
        if now.hour != 8:
            print(f"skip: IST hour is {now.hour} (need 8); use --force")
            return

    with app.app_context():
        stats = run_session_reminders()
        print(stats)


if __name__ == "__main__":
    main()
