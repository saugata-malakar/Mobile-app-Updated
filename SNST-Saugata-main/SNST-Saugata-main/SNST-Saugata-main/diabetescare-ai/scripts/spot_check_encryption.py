"""
Database Encryption Spot-Check Verification Script

Checks:
1. Direct database read of photographs: assert they are stored as ciphertext (prefixed with 'enc_gcm:').
2. API retrieval of photographs: assert they are returned as decrypted plaintext.
"""

import sys
import os
import json
import uuid
from datetime import datetime, timezone
from fastapi.testclient import TestClient

# Add root directory to python path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from backend.api.main import app
from backend.database.session import SessionLocal, init_db
from backend.database.models import Patient, Screening, AuditLog
from backend.database.erasure import ErasurePipeline


def run_spot_check():
    print("[INFO] Initiating database encryption spot-check...")
    init_db()
    db = SessionLocal()
    client = TestClient(app)
    
    phone = "8887776665"
    
    # 1. Clean up old records
    existing = db.query(Patient).filter_by(phone=phone).first()
    if existing:
        pipeline = ErasurePipeline(db)
        pipeline.execute_erasure(str(existing.patient_id))
        
    # 2. Register test patient
    register_payload = {
        "name": "Spot Check Patient",
        "phone": phone,
        "age": 40,
        "gender": "Female",
        "village": "SpotVillage",
        "district": "SpotDistrict",
        "password": "password123",
        "date_of_birth": "1986-01-01"
    }
    
    reg_response = client.post("/api/v1/auth/patient/register", json=register_payload)
    if reg_response.status_code != 201:
        print(f"[ERROR] Patient registration failed: {reg_response.text}")
        return
        
    reg_data = reg_response.json()["data"]
    token = reg_data["token"]
    patient_id = reg_data["patient"]["id"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # 3. Create screening with test photographs
    original_photo_base64 = "data:image/jpeg;base64,abcdefghijklmnopqrstuvwx"
    screening_payload = {
        "condition_type": "wound",
        "risk_level": "medium",
        "consent_timestamp": datetime.now(timezone.utc).isoformat(),
        "photos": [original_photo_base64],
        "notes": "Testing AES-256-GCM image encryption at rest."
    }
    
    screen_response = client.post("/api/v1/screenings", json=screening_payload, headers=headers)
    if screen_response.status_code != 201:
        print(f"[ERROR] Screening creation failed: {screen_response.text}")
        return
        
    screening_id = screen_response.json()["data"]["screening_id"]
    print(f"[INFO] Screening created successfully with ID: {screening_id}")
    
    # 4. SPOT CHECK DATABASE DIRECTLY (Direct SQL check)
    db.expire_all()
    db_screening = db.query(Screening).filter_by(id=screening_id).first()
    assert db_screening is not None
    
    raw_photo_data = db_screening.photo_data
    print(f"[INFO] Directly queried photo_data column from DB: {raw_photo_data[:100]}...")
    
    # Assertions for Encryption at Rest
    parsed_photos = json.loads(raw_photo_data)
    assert isinstance(parsed_photos, list)
    stored_photo = parsed_photos[0]
    
    # Check encryption prefix
    if stored_photo.startswith("enc_gcm:"):
        print("[SUCCESS] Stored photo starts with 'enc_gcm:' prefix.")
    else:
        print("[FAIL] Stored photo is NOT prefixed with 'enc_gcm:'!")
        return
        
    # Check that plaintext base64 string is not present in stored data
    if original_photo_base64 in stored_photo or "abcdef" in stored_photo:
        print("[FAIL] Plaintext image contents found in the database!")
        return
    else:
        print("[SUCCESS] Verified: Stored data contains encrypted ciphertext (no plaintext).")
        
    # 5. RETRIEVE VIA API (Decryption validation)
    api_response = client.get(f"/api/v1/screenings/{screening_id}", headers=headers)
    assert api_response.status_code == 200
    
    api_photo_data = api_response.json()["data"]["photo_data"]
    assert isinstance(api_photo_data, list)
    retrieved_photo = api_photo_data[0]
    
    if retrieved_photo == "abcdefghijklmnopqrstuvwx":
        print("[SUCCESS] API decrypted photo successfully. Matches original raw string.")
    else:
        print(f"[FAIL] Decrypted photo does not match original: {retrieved_photo}")
        return
        
    # 6. Clean up
    pipeline = ErasurePipeline(db)
    pipeline.execute_erasure(patient_id)
    db.close()
    
    print("[SUCCESS] Spot-check complete: Photographs are fully encrypted at rest and safely decrypted on read!")


if __name__ == "__main__":
    run_spot_check()
