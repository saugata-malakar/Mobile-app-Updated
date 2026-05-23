import logging
import os

from dotenv import load_dotenv
from flask import Flask, request
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flask_migrate import Migrate

from config import CONFIG_MAP, DevelopmentConfig
from middleware.rate_limiter import limiter
from middleware.request_logger import register_request_logging
from models import db
from routes import register_blueprints

load_dotenv()


def create_app():
    app = Flask(__name__)
    env = os.environ.get("FLASK_ENV", "development")
    cfg = CONFIG_MAP.get(env, DevelopmentConfig)
    app.config.from_object(cfg)

    if not app.config.get("SQLALCHEMY_DATABASE_URI"):
        app.config["SQLALCHEMY_DATABASE_URI"] = os.environ.get("DATABASE_URL")

    db.init_app(app)
    Migrate(app, db)
    JWTManager(app)
    limiter.init_app(app)

    origins = app.config.get("ALLOWED_ORIGINS") or ["*"]
    CORS(
        app,
        resources={
            r"/api/*": {"origins": origins, "allow_headers": ["Content-Type", "Authorization", "X-Device-ID"]},
            r"/health": {"origins": "*"},
        },
    )

    register_blueprints(app)
    register_request_logging(app)

    if app.config.get("TESTING"):
        limiter.enabled = False

    log_level = os.environ.get("LOG_LEVEL", "INFO")
    app.logger.setLevel(getattr(logging, log_level, logging.INFO))

    @app.before_request
    def log_request():
        app.logger.info("%s %s", request.method, request.path)

    @app.after_request
    def security_headers(response):
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        return response

    with app.app_context():
        db.create_all()
        from migrations.seed_phase_a import ensure_phase_a_seed

        ensure_phase_a_seed()
        try:
            from migrations.upgrade_subscription_d1 import upgrade_subscription_d1

            upgrade_subscription_d1()
        except Exception:
            db.session.rollback()
        try:
            from migrations.upgrade_doctors_web import upgrade_doctors_web

            upgrade_doctors_web()
        except Exception:
            db.session.rollback()
        try:
            from migrations.upgrade_teleconsult_requests_c4 import upgrade

            upgrade()
        except Exception:
            db.session.rollback()
        try:
            from migrations.seed_doctor_demo import ensure_demo_doctor

            ensure_demo_doctor()
        except Exception:
            db.session.rollback()

    return app


app = create_app()


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5001"))
    app.run(host="0.0.0.0", port=port, debug=bool(int(os.environ.get("FLASK_DEBUG", "1"))))
