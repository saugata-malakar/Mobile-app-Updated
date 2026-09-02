from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.api.middleware import JWTAuthMiddleware, AuditTrailMiddleware
from backend.api.routers import auth, consent, patients, doctors
from backend.database.session import create_tables

app = FastAPI(
    title="DiabetesCare AI",
    description="IIT Kharagpur — DPDP-compliant diabetic complication screening platform",
    version="1.0.0",
)

# ── Tables ────────────────────────────────────────────────────────────────────
create_tables()

# ── Middleware (order matters: outermost added last) ──────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(AuditTrailMiddleware)
app.add_middleware(JWTAuthMiddleware)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(auth.router,      prefix="/api/v1/auth",     tags=["auth"])
app.include_router(patients.router,  prefix="/api/v1/patients", tags=["patients"])
app.include_router(consent.router,   prefix="/api/v1/consent",  tags=["consent"])
app.include_router(doctors.router,   prefix="/api/v1/doctors",  tags=["doctors"])

# ── Health ────────────────────────────────────────────────────────────────────
@app.get("/health", tags=["system"])
def health_check():
    return {"status": "ok", "service": "DiabetesCare AI"}
