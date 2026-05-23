import uuid
from datetime import datetime, timezone

from flask import g, request

from models import AuditLog, db

SYSTEM_USER = str(uuid.UUID(int=0))


def register_request_logging(app):
    @app.before_request
    def _mark_request_start():
        g._audit_user_id = getattr(g, "audit_user_id", None)
        g._audit_user_type = getattr(g, "audit_user_type", None)

    @app.after_request
    def _audit_log_response(response):
        try:
            uid = getattr(g, "current_user", None)
            user_id = getattr(uid, "id", None) if uid is not None else None
            user_type = getattr(g, "user_type", None) or "system"
            if user_id is None:
                user_id = SYSTEM_USER
                user_type = "system"
            log = AuditLog(
                user_id=user_id,
                user_type=user_type,
                action=f"{request.method} {request.path}",
                resource_type="http_request",
                resource_id=None,
                ip_address=request.remote_addr,
                status_code=response.status_code,
                created_at=datetime.now(timezone.utc),
            )
            db.session.add(log)
            db.session.commit()
        except Exception:
            db.session.rollback()
        return response
