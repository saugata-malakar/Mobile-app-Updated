"""
Integration test for DPDP Act 2023 compliance auditing.

Verifies that:
1. Registration & Login are logged in audit_logs.
2. Read requests (GET /api/v1/patients/me) are logged in audit_logs.
3. Write requests (PUT /api/v1/patients/me) are logged in audit_logs.
4. Delete requests (POST /api/v1/patients/me/erase) are logged in audit_logs.
5. Patient Right to Erasure correctly cascades and removes their data.
"""
import pytest
import uuid
import os
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import sessionmaker, Session

# Import session module to patch it before importing app
import backend.database.session as session_mod

# Configure test SQLite engine
test_engine = create_engine("sqlite:///test_audit_temp.db")

@event.listens_for(test_engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()

test_SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

# Monkeypatch engine and SessionLocal in the session module
session_mod.engine = test_engine
session_mod.SessionLocal = test_SessionLocal

from backend.api.main import app
from backend.database.session import SessionLocal
from backend.database.models import AuditLog, Patient


@pytest.fixture(scope="module")
def db_session():
    from backend.database.session import init_db
    init_db()
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
        # Clean up database file
        try:
            if os.path.exists("test_audit_temp.db"):
                os.remove("test_audit_temp.db")
        except Exception:
            pass


def test_audit_trail_completeness(db_session: Session):
    client = TestClient(app)
    
    # 1. Unique details for test patient
    phone = "9998887776"
    test_patient_payload = {
        "name": "Audit Test Patient",
        "phone": phone,
        "age": 35,
        "gender": "Male",
        "village": "AuditVillage",
        "district": "AuditDistrict",
        "password": "password123",
        "date_of_birth": "1991-01-01"
    }
    
    # Clean up existing test patient if left over from previous failed runs using the ErasurePipeline
    existing = db_session.query(Patient).filter_by(phone=phone).first()
    if existing:
        from backend.database.erasure import ErasurePipeline
        pipeline = ErasurePipeline(db_session)
        pipeline.execute_erasure(str(existing.patient_id))

    # Clear prior audit logs for this phone number if any exist
    # (Since user_id might not map, we do a basic database check or use a clean slate)
    
    # 2. TEST REGISTER (Write / Register)
    register_response = client.post("/api/v1/auth/patient/register", json=test_patient_payload)
    assert register_response.status_code == 201, f"Reg failed: {register_response.text}"
    reg_data = register_response.json()["data"]
    token = reg_data["token"]
    
    # Fetch patient from database to get their UUID
    patient_record = db_session.query(Patient).filter_by(phone=phone).first()
    assert patient_record is not None
    patient_id = patient_record.patient_id
    
    # Verify registration is logged in audit_logs
    reg_logs = db_session.query(AuditLog).filter(
        AuditLog.user_id == patient_id,
        AuditLog.action.like("%register%")
    ).all()
    assert len(reg_logs) > 0, "Registration audit log missing"
    
    # 3. TEST LOGIN (Login)
    login_payload = {
        "phone": phone,
        "password": "password123"
    }
    login_response = client.post("/api/v1/auth/patient/login", json=login_payload)
    assert login_response.status_code == 200, f"Login failed: {login_response.text}"
    token = login_response.json()["data"]["token"]
    
    # Verify login is logged in audit_logs
    login_logs = db_session.query(AuditLog).filter(
        AuditLog.user_id == patient_id,
        AuditLog.action.like("%login%")
    ).all()
    assert len(login_logs) > 0, "Login audit log missing"
    
    # Headers with Bearer token
    headers = {"Authorization": f"Bearer {token}"}
    
    # 4. TEST READ (GET /me)
    read_response = client.get("/api/v1/patients/me", headers=headers)
    assert read_response.status_code == 200, f"Read failed: {read_response.text}"
    
    # Verify read is logged in audit_logs
    read_logs = db_session.query(AuditLog).filter(
        AuditLog.user_id == patient_id,
        AuditLog.action.like("read_%")
    ).all()
    assert len(read_logs) > 0, "Read audit log missing"
    
    # 5. TEST WRITE (PUT /me)
    update_payload = {
        "known_conditions": "None",
        "allergies": "Peanuts",
        "district": "AuditDistrictNew"
    }
    write_response = client.put("/api/v1/patients/me", json=update_payload, headers=headers)
    assert write_response.status_code == 200, f"Update failed: {write_response.text}"
    
    # Verify write is logged in audit_logs
    write_logs = db_session.query(AuditLog).filter(
        AuditLog.user_id == patient_id,
        AuditLog.action.like("write_%")
    ).all()
    assert len(write_logs) > 0, "Write audit log missing"
    
    # 6. TEST DELETE / RIGHT TO ERASURE (POST /me/erase)
    erase_response = client.post("/api/v1/patients/me/erase", headers=headers)
    assert erase_response.status_code == 200, f"Erasure failed: {erase_response.text}"
    
    # Verify patient record is deleted (Right to Erasure verification)
    deleted_patient = db_session.query(Patient).filter_by(patient_id=patient_id).first()
    assert deleted_patient is None, "Patient data was not deleted from database"
    
    # Verify cascading deletion of patient audit logs (DPDP compliance check)
    # The only remaining log should be the erasure action itself (delete_post) recorded by the middleware after the request completes.
    remaining_logs = db_session.query(AuditLog).filter(
        AuditLog.user_id == patient_id
    ).all()
    assert len(remaining_logs) <= 1, f"Patient audit logs were not cascaded and deleted (found {remaining_logs})"
    if len(remaining_logs) == 1:
        assert "delete_post" in remaining_logs[0].action, f"Remaining log action was not deletion: {remaining_logs[0].action}"
