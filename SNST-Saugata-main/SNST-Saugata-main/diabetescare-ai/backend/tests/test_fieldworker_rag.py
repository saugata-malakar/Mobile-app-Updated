"""
Integration Test for ASHA Fieldworker RAG API Endpoint
"""

import pytest
from fastapi.testclient import TestClient
from backend.api.main import app

def test_fieldworker_rag_endpoint():
    client = TestClient(app)
    
    payload = {
        "question": "What is diabetic neuropathy?",
        "k": 2
    }
    
    response = client.post("/api/v1/fieldworker/ask", json=payload)
    assert response.status_code == 200, f"RAG endpoint failed: {response.text}"
    
    data = response.json()
    assert "question" in data
    assert "answer" in data
    assert "sources" in data
    assert data["question"] == "What is diabetic neuropathy?"
    assert isinstance(data["sources"], list)
    assert len(data["sources"]) <= 2
    assert any("neuropathy" in src.lower() or "nerve" in src.lower() for src in data["sources"])
