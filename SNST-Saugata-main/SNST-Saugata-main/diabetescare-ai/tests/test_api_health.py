"""FastAPI health endpoint tests."""

from fastapi.testclient import TestClient

from backend.api.main import app


def test_health_endpoint():
    client = TestClient(app)
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["service"] == "diabetescare-ai-api"
