#!/usr/bin/env python3
"""
DiabetesCare AI — Offline Phone Photo Extraction & Sync Utility
Pulls any photos stored locally inside the Poco M6 Pro 5G / Android phone
via USB/ADB directly into your PC's stored_photos directory and indexes them in SQLite.
"""

import os
import sys
import uuid
import shutil
import sqlite3
import subprocess
from datetime import datetime

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
PHOTOS_DIR = os.path.join(ROOT_DIR, "stored_photos")
DB_PATH = os.path.join(ROOT_DIR, "diabetescare.db")
os.makedirs(PHOTOS_DIR, exist_ok=True)

def find_adb():
    # Check PATH or Android SDK platform-tools
    common_paths = [
        "adb",
        os.path.expanduser(r"~\AppData\Local\Android\Sdk\platform-tools\adb.exe"),
        r"C:\Program Files (x86)\Android\android-sdk\platform-tools\adb.exe",
    ]
    for p in common_paths:
        try:
            res = subprocess.run([p, "version"], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            if res.returncode == 0:
                return p
        except Exception:
            continue
    return None

def sync_from_phone():
    print("=" * 78)
    print("       DIABETESCARE AI -- USB/ADB PHONE PHOTO SYNC UTILITY")
    print("=" * 78)
    adb = find_adb()
    if not adb:
        print("[!] ADB not found on PC PATH or Android SDK.")
        print("    If your phone is on Wi-Fi, simply run START_SERVER.bat on your PC")
        print("    and the mobile app will automatically upload directly over Wi-Fi.")
        return

    print(f"Using ADB at: {adb}")
    res = subprocess.run([adb, "devices"], capture_output=True, text=True)
    print(res.stdout)
    devices = [line.split()[0] for line in res.stdout.strip().splitlines()[1:] if "device" in line and not line.startswith("*")]

    if not devices:
        print("[!] No connected Android phone detected via USB.")
        print("    Please connect your Poco M6 Pro 5G via USB and enable USB Debugging,")
        print("    OR simply keep both devices on the same Wi-Fi and use START_SERVER.bat.")
        return

    device = devices[0]
    print(f"Connected Device Detected: {device}")
    temp_dir = os.path.join(ROOT_DIR, "temp_phone_pull")
    os.makedirs(temp_dir, exist_ok=True)

    remote_paths = [
        "/sdcard/Android/data/com.helloworld/cache/",
        "/sdcard/DCIM/Camera/",
        "/data/local/tmp/",
    ]

    pulled_count = 0
    now_iso = datetime.utcnow().isoformat()

    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    for rpath in remote_paths:
        print(f"Checking {rpath} ...")
        cmd = [adb, "-s", device, "pull", rpath, temp_dir]
        subprocess.run(cmd, capture_output=True)

    # Move any pulled jpg/png to stored_photos
    for root, _, files in os.walk(temp_dir):
        for f in files:
            if f.lower().endswith(('.jpg', '.jpeg', '.png')):
                src = os.path.join(root, f)
                dest_name = f"USB_PULL_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}_{f}"
                dest = os.path.join(PHOTOS_DIR, dest_name)
                shutil.copy2(src, dest)
                pulled_count += 1
                
                # Index in SQLite
                p_id = f"PHT_{uuid.uuid4().hex[:10].upper()}"
                rel_path = f"stored_photos/{dest_name}"
                c.execute(
                    "INSERT INTO foot_photos (photo_id, session_id, patient_id, photo_data, created_at) VALUES (?, ?, ?, ?, ?)",
                    (p_id, "VIS_USB_SYNC", "PAT_PHONE_SYNC", rel_path, now_iso)
                )

    conn.commit()
    conn.close()

    shutil.rmtree(temp_dir, ignore_errors=True)
    print("-" * 78)
    print(f"Completed! Pulled {pulled_count} photos to: {PHOTOS_DIR}")
    print("Indexed in diabetescare.db.")
    print("=" * 78)

if __name__ == "__main__":
    sync_from_phone()
