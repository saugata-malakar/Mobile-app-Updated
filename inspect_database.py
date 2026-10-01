#!/usr/bin/env python3
"""
DiabetesCare AI — Local Database & Photo Inspection Utility
Provides 100% complete transparency and user control over stored photos and SQLite records.
"""

import os
import sys
import sqlite3
import subprocess
from datetime import datetime

# Configure Windows terminal encoding to UTF-8
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
PHOTOS_DIR = os.path.join(ROOT_DIR, "stored_photos")
DB_PATH = os.path.join(ROOT_DIR, "diabetescare.db")
ALT_DB_PATH = os.path.join(ROOT_DIR, "diabetescare-ai", "diabetescare.db")

def format_size(num_bytes: int) -> str:
    for unit in ['B', 'KB', 'MB', 'GB']:
        if num_bytes < 1024.0:
            return f"{num_bytes:3.1f} {unit}"
        num_bytes /= 1024.0
    return f"{num_bytes:.1f} TB"

def print_banner():
    print("=" * 78)
    print("       DIABETESCARE AI -- LOCAL DATABASE & PHOTO REPOSITORY")
    print("       Full User Control & Physical Storage Inspector")
    print("=" * 78)
    print(f" Root Directory   : {ROOT_DIR}")
    print(f" Photos Directory : {PHOTOS_DIR}")
    print(f" Master Database  : {DB_PATH}")
    print("=" * 78)
    print()

def inspect_disk_photos():
    print("[1/3] PHYSICAL PHOTO STORAGE ON DISK:")
    print("-" * 78)
    if not os.path.exists(PHOTOS_DIR):
        print(f"  Directory not found: {PHOTOS_DIR}")
        return []

    files = [f for f in os.listdir(PHOTOS_DIR) if not f.startswith('.')]
    if not files:
        print(f"  Folder '{PHOTOS_DIR}' is currently empty (no photos saved yet).")
        print()
        return []

    total_bytes = 0
    print(f"  {'Filename':<45} {'Size':<12} {'Modified Date'}")
    print(f"  {'-'*45} {'-'*12} {'-'*19}")
    for fname in sorted(files):
        fpath = os.path.join(PHOTOS_DIR, fname)
        size = os.path.getsize(fpath)
        total_bytes += size
        mtime = datetime.fromtimestamp(os.path.getmtime(fpath)).strftime("%Y-%m-%d %H:%M:%S")
        print(f"  {fname:<45} {format_size(size):<12} {mtime}")

    print("-" * 78)
    print(f"  Total Photos on Disk: {len(files)} | Total Disk Space: {format_size(total_bytes)}")
    print()
    return files

def inspect_sqlite():
    print("[2/3] SQLITE RELATIONAL DATABASE RECORDS:")
    print("-" * 78)

    active_db = DB_PATH if os.path.exists(DB_PATH) else ALT_DB_PATH
    if not os.path.exists(active_db):
        print(f"  Database file not found at {active_db}")
        return

    conn = sqlite3.connect(active_db)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()

    # 1. Patients
    print("  -> Table: 'patients'")
    c.execute("SELECT patient_id, pseudonym, age_band, gender, district, created_at FROM patients ORDER BY created_at DESC")
    patients = c.fetchall()
    if not patients:
        print("    (No patients recorded yet)")
    else:
        for p in patients:
            print(f"    * ID: {p['patient_id']} | Pseudonym: {p['pseudonym']} | Age: {p['age_band']} | District: {p['district']} | Registered: {p['created_at']}")
    print()

    # 2. Wound Sessions
    print("  -> Table: 'wound_sessions'")
    c.execute("SELECT session_id, patient_id, severity_grade, tissue_colour, wound_area_cm2, session_date FROM wound_sessions ORDER BY created_at DESC")
    sessions = c.fetchall()
    if not sessions:
        print("    (No wound sessions recorded yet)")
    else:
        for s in sessions:
            area = f"{s['wound_area_cm2']:.2f} cm2" if s['wound_area_cm2'] is not None else "N/A"
            print(f"    * Session: {s['session_id']} | Patient: {s['patient_id']} | Area: {area} | Wagner: Grade {s['severity_grade']} | Date: {s['session_date']}")
    print()

    # 3. Foot Photos
    print("  -> Table: 'foot_photos'")
    c.execute("SELECT photo_id, session_id, patient_id, photo_data, created_at FROM foot_photos ORDER BY created_at DESC")
    photos = c.fetchall()
    if not photos:
        print("    (No photo records in foot_photos yet)")
    else:
        for ph in photos:
            print(f"    * Photo ID: {ph['photo_id']} | Patient: {ph['patient_id']} | Path: {ph['photo_data']} | Captured: {ph['created_at']}")
    print()
    conn.close()

def open_folder():
    print("[3/3] PHYSICAL ACCESS:")
    print(f"  All photos and databases reside locally on your PC.")
    print(f"  Opening Windows Explorer to: {PHOTOS_DIR}")
    if os.name == 'nt' and os.path.exists(PHOTOS_DIR):
        try:
            os.startfile(PHOTOS_DIR)
        except Exception as e:
            print(f"  Could not open Explorer automatically: {e}")

if __name__ == "__main__":
    print_banner()
    inspect_disk_photos()
    inspect_sqlite()
    if "--open" in sys.argv or "-o" in sys.argv:
        open_folder()
    else:
        print("TIP: Run 'python inspect_database.py --open' or double-click 'INSPECT_DATABASE.bat'")
        print("     to automatically open your stored photos folder in Windows Explorer.")
    print("=" * 78)
