import os
from datetime import timedelta


def _split_origins(value: str | None) -> list[str]:
    if not value:
        return []
    return [o.strip() for o in value.split(",") if o.strip()]


class BaseConfig:
    SECRET_KEY = os.environ.get("SECRET_KEY") or os.environ.get("JWT_SECRET_KEY", "dev-secret")
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    # When True, skip real FCM/Twilio sends but still write notifications rows (tests / local).
    NOTIFICATIONS_DRY_RUN = os.environ.get("NOTIFICATIONS_DRY_RUN", "0").lower() in ("1", "true", "yes")
    RAZORPAY_KEY_ID = os.environ.get("RAZORPAY_KEY_ID", "rzp_test_mock")
    RAZORPAY_KEY_SECRET = os.environ.get("RAZORPAY_KEY_SECRET", "")
    RAZORPAY_MOCK = os.environ.get("RAZORPAY_MOCK", "1").lower() in ("1", "true", "yes")
    FIREBASE_CREDENTIALS_JSON = os.environ.get("FIREBASE_CREDENTIALS_JSON")
    GOOGLE_APPLICATION_CREDENTIALS = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    TWILIO_ACCOUNT_SID = os.environ.get("TWILIO_ACCOUNT_SID")
    TWILIO_AUTH_TOKEN = os.environ.get("TWILIO_AUTH_TOKEN")
    TWILIO_FROM_NUMBER = os.environ.get("TWILIO_FROM_NUMBER")
    TWILIO_SMS_DEFAULT_COUNTRY_CODE = os.environ.get("TWILIO_SMS_DEFAULT_COUNTRY_CODE", "91")
    JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "change-me")
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(seconds=int(os.environ.get("JWT_ACCESS_TOKEN_EXPIRES", "86400")))
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=int(os.environ.get("JWT_REFRESH_TOKEN_EXPIRES_DAYS", "30")))
    MAX_CONTENT_LENGTH = int(os.environ.get("MAX_CONTENT_LENGTH", str(20 * 1024 * 1024)))
    ALLOWED_ORIGINS = _split_origins(os.environ.get("ALLOWED_ORIGINS"))
    SQLALCHEMY_ENGINE_OPTIONS = {}


def _sqlite_engine_options(db_uri: str | None) -> dict:
    if not db_uri:
        return {}
    if not db_uri.startswith("sqlite"):
        return {}
    # Needed for local dev / tests where multiple threads can touch SQLite.
    return {"connect_args": {"check_same_thread": False}}


class DevelopmentConfig(BaseConfig):
    DEBUG = True
    SQLALCHEMY_DATABASE_URI = os.environ.get("DATABASE_URL")
    SQLALCHEMY_ECHO = True
    SQLALCHEMY_ENGINE_OPTIONS = _sqlite_engine_options(SQLALCHEMY_DATABASE_URI)


class ProductionConfig(BaseConfig):
    DEBUG = False
    SQLALCHEMY_DATABASE_URI = os.environ.get("DATABASE_URL")
    SQLALCHEMY_ENGINE_OPTIONS = _sqlite_engine_options(SQLALCHEMY_DATABASE_URI)


class TestingConfig(BaseConfig):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = "sqlite:///test.db"
    SQLALCHEMY_ECHO = False
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(seconds=3600)
    NOTIFICATIONS_DRY_RUN = True


CONFIG_MAP = {
    "development": DevelopmentConfig,
    "production": ProductionConfig,
    "testing": TestingConfig,
}
