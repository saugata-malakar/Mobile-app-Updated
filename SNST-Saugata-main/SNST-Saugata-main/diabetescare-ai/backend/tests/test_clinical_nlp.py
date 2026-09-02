"""
Unit and integration tests for the Clinical NLP Pipeline (Part 11).

Validates:
- Negation detection (direct, prepositional, subject).
- Database persistence of clinical notes.
- Latency threshold (< 100ms).
"""

import pytest
import uuid
import os
import time
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, Session

# Import session module to patch it before importing app
import backend.database.session as session_mod

# Configure test SQLite engine
test_engine = create_engine("sqlite:///test_nlp_temp.db")

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
from backend.database.models import Patient, ClinicalNote
from ml.clinical_nlp.clinical_nlp_pipeline import ClinicalNLPPipeline


@pytest.fixture(scope="module")
def db_session():
    from backend.database.session import init_db
    init_db()
    db = SessionLocal()
    try:
        # Create a test patient to satisfy Foreign Key constraints
        pid = uuid.UUID("123e4567-e89b-12d3-a456-426614174000")
        existing_patient = db.query(Patient).filter_by(patient_id=pid).first()
        if not existing_patient:
            test_patient = Patient(
                patient_id=pid,
                name="Test Patient",
                phone="9876543210",
                age=45,
                gender="M",
                district="Mumbai"
            )
            db.add(test_patient)
            db.commit()
        yield db
    finally:
        db.close()
        # Clean up database file
        try:
            if os.path.exists("test_nlp_temp.db"):
                os.remove("test_nlp_temp.db")
        except Exception:
            pass


def test_negation_rules_direct():
    """Test direct negation detection (e.g., 'no cellulitis')."""
    pipeline = ClinicalNLPPipeline()
    
    note = "Patient has no cellulitis. Wound is on left foot."
    entities = pipeline.extract_entities(note)
    
    # cellulitis should be negated/filtered out
    assert "cellulitis" not in entities["infection_sign"]
    # left foot is positive and should be extracted
    assert "left foot" in entities["wound_location"]


def test_negation_rules_prepositional():
    """Test prepositional negation detection (e.g., 'without discharge')."""
    pipeline = ClinicalNLPPipeline()
    
    note = "Patient presents without purulent discharge, but erythema is present."
    entities = pipeline.extract_entities(note)
    
    # purulent discharge should be negated/filtered out
    assert "purulent discharge" not in entities["infection_sign"]
    # erythema is positive and should be extracted
    assert "erythema" in entities["infection_sign"]


def test_negation_rules_subject():
    """Test subject/verb negation detection (e.g., 'denies fever', 'rules out osteomyelitis')."""
    pipeline = ClinicalNLPPipeline()
    
    note = "Wound is on right toe. Patient denies fever and osteomyelitis is ruled out."
    entities = pipeline.extract_entities(note)
    
    # fever and osteomyelitis should be negated/filtered out
    assert "fever" not in entities["infection_sign"]
    assert "osteomyelitis" not in entities["infection_sign"]
    # right toe is positive and should be extracted
    assert "right toe" in entities["wound_location"]


def test_nlp_endpoint_persistence(db_session: Session):
    """Test that /api/v1/nlp/extract saves the note and its entities to the database."""
    client = TestClient(app)
    
    patient_id = "123e4567-e89b-12d3-a456-426614174000"
    payload = {
        "note_text": "Patient has cellulitis on left heel. Start IV antibiotics.",
        "patient_id": patient_id
    }
    
    response = client.post("/api/v1/nlp/extract", json=payload)
    assert response.status_code == 200, f"NLP extraction failed: {response.text}"
    
    data = response.json()
    note_id = uuid.UUID(data["note_id"])
    
    # Query database to assert persistence
    db_note = db_session.query(ClinicalNote).filter_by(note_id=note_id).first()
    assert db_note is not None, "Clinical note was not persisted to the database"
    assert db_note.original_text == payload["note_text"]
    assert "left heel" in db_note.wound_locations
    assert "cellulitis" in db_note.infection_signs
    assert "IV antibiotics" in db_note.treatment_recommendations


def test_nlp_extraction_latency():
    """Test that the clinical NLP extraction has latency of < 100ms after warm-up."""
    client = TestClient(app)
    patient_id = "123e4567-e89b-12d3-a456-426614174000"
    payload = {
        "note_text": "Patient has cellulitis on left heel. Start IV antibiotics.",
        "patient_id": patient_id
    }
    
    # Warm up spaCy pipeline
    client.post("/api/v1/nlp/extract", json=payload)
    
    # Measure latency
    start_time = time.perf_counter()
    response = client.post("/api/v1/nlp/extract", json=payload)
    end_time = time.perf_counter()
    
    assert response.status_code == 200
    latency_ms = (end_time - start_time) * 1000
    print(f"\nNLP extraction latency: {latency_ms:.2f} ms")
    assert latency_ms < 100.0, f"Extraction latency was {latency_ms:.2f} ms (expected < 100ms)"
