from routes.admin import admin_bp
from routes.alerts import alerts_bp
from routes.asha import asha_bp
from routes.auth import auth_bp
from routes.consultations import consultations_bp
from routes.doctors import doctors_bp
from routes.health import health_bp
from routes.patients import patients_bp
from routes.screenings import screenings_bp
from routes.notifications import notifications_bp
from routes.sessions import sessions_bp
from routes.teleconsults import teleconsults_bp
from routes.subscriptions import subscriptions_bp
from routes.payments import payments_bp


def register_blueprints(app):
    app.register_blueprint(health_bp)
    app.register_blueprint(auth_bp, url_prefix="/api/v1/auth")
    app.register_blueprint(patients_bp, url_prefix="/api/v1/patients")
    app.register_blueprint(alerts_bp, url_prefix="/api/v1/alerts")
    app.register_blueprint(sessions_bp, url_prefix="/api/v1/sessions")
    app.register_blueprint(notifications_bp, url_prefix="/api/v1/notifications")
    app.register_blueprint(screenings_bp, url_prefix="/api/v1/screenings")
    app.register_blueprint(consultations_bp, url_prefix="/api/v1/consultations")
    app.register_blueprint(asha_bp, url_prefix="/api/v1/asha")
    app.register_blueprint(doctors_bp, url_prefix="/api/v1/doctors")
    app.register_blueprint(admin_bp, url_prefix="/api/v1/admin")
    app.register_blueprint(teleconsults_bp, url_prefix="/api/v1/teleconsults")
    app.register_blueprint(subscriptions_bp, url_prefix="/api/v1/subscriptions")
    app.register_blueprint(payments_bp, url_prefix="/api/v1/payments")
