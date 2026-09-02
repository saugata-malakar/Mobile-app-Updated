import os
from datetime import datetime

from fastapi import Request
from fastapi.responses import JSONResponse
from jose import JWTError, jwt
from sqlalchemy.orm import Session
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

from backend.database.models import AuditLog
import backend.database.session as _db_session_module

def _get_session_local():
    return _db_session_module.SessionLocal

SECRET_KEY = os.getenv("SECRET_KEY", "diabetescare-dev-secret-change-in-prod")
ALGORITHM  = "HS256"

# Paths that never require a JWT
_PUBLIC_PREFIXES = ("/api/v1/auth/",)
_PUBLIC_EXACT    = {"/health", "/docs", "/redoc", "/openapi.json"}


def _classify_action(method: str) -> str:
    return {
        "GET":    "READ",
        "POST":   "WRITE",
        "PUT":    "WRITE",
        "PATCH":  "WRITE",
        "DELETE": "DELETE",
    }.get(method.upper(), "READ")


# ── JWT Auth Middleware ────────────────────────────────────────────────────────
class JWTAuthMiddleware(BaseHTTPMiddleware):
    def __init__(self, app: ASGIApp):
        super().__init__(app)

    async def dispatch(self, request: Request, call_next):
        path = request.url.path

        # Let public paths through
        if path in _PUBLIC_EXACT:
            return await call_next(request)
        for prefix in _PUBLIC_PREFIXES:
            if path.startswith(prefix):
                return await call_next(request)

        # Validate Bearer token
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return JSONResponse(
                {"detail": "Not authenticated"},
                status_code=401,
            )

        token = auth_header.split(" ", 1)[1]
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            request.state.user_id = payload.get("sub", "")
            request.state.role    = payload.get("role", "")
        except JWTError:
            return JSONResponse(
                {"detail": "Invalid or expired token"},
                status_code=401,
            )

        return await call_next(request)


# ── Audit Trail Middleware ─────────────────────────────────────────────────────
class AuditTrailMiddleware(BaseHTTPMiddleware):
    """Writes one row to audit_logs for every request that reaches /api/."""

    def __init__(self, app: ASGIApp):
        super().__init__(app)

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)

        path = request.url.path
        if not path.startswith("/api/"):
            return response

        # Resolve user / patient ids from request state (set by JWT middleware)
        user_id    = getattr(request.state, "user_id", None)
        patient_id = request.path_params.get("patient_id") or request.query_params.get("patient_id")

        action = _classify_action(request.method)
        # Override to LOGIN when hitting auth login
        if "auth/login" in path:
            action = "LOGIN"

        try:
            db: Session = _get_session_local()()
            log = AuditLog(
                timestamp   = datetime.utcnow(),
                user_id     = str(user_id) if user_id else None,
                patient_id  = str(patient_id) if patient_id else None,
                action      = action,
                endpoint    = path,
                method      = request.method.upper(),
                status_code = response.status_code,
                ip_address  = request.client.host if request.client else None,
            )
            db.add(log)
            db.commit()
        except Exception:
            pass  # audit must never break the request path
        finally:
            db.close()

        return response
