"""DiabetesCare AI — FastAPI entry point."""

from fastapi import FastAPI

app = FastAPI(
    title="DiabetesCare AI API",
    description="Inference and research API for diabetic complication detection",
    version="0.1.0",
)


@app.get("/health")
def health() -> dict:
    """Liveness check for load balancers and CI."""
    return {"status": "ok", "service": "diabetescare-ai-api"}


# Routers (Week 2+):
# from backend.api.routers import wound, skin, eye
# app.include_router(wound.router, prefix="/v1/wound", tags=["wound"])
