"""
ERP Backend Configuration.
"""
import logging
from functools import lru_cache

from pydantic_settings import BaseSettings

_logger = logging.getLogger(__name__)

_INSECURE_DEFAULT = "mashora-erp-secret-change-in-production"


class Settings(BaseSettings):
    # App
    app_name: str = "Mashora API"
    debug: bool = False
    api_prefix: str = "/api/v1"

    # CORS — comma-separated allowed origins
    cors_origins: str = "http://localhost:3000,http://localhost:8069"

    # Database (SQLAlchemy async + asyncpg)
    mashora_db_name: str = "mashora_erp"
    mashora_db_host: str = "localhost"
    mashora_db_port: int = 5432
    mashora_db_user: str = "mashora"
    mashora_db_password: str = ""
    mashora_db_maxconn: int = 16

    # JWT Auth
    jwt_secret_key: str = _INSECURE_DEFAULT
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 60
    jwt_refresh_token_expire_days: int = 30

    # Email / SMTP
    smtp_host: str = "localhost"
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_use_tls: bool = True
    smtp_use_ssl: bool = False
    smtp_from_email: str = "noreply@mashora.com"
    smtp_from_name: str = "Mashora ERP"

    # Calendar Sync (Google)
    google_calendar_client_id: str = ""
    google_calendar_client_secret: str = ""

    # Calendar Sync (Microsoft)
    microsoft_calendar_client_id: str = ""
    microsoft_calendar_client_secret: str = ""
    microsoft_calendar_tenant_id: str = "common"

    # Server
    host: str = "0.0.0.0"
    port: int = 8001

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}

    def validate_production(self) -> None:
        """Reject insecure defaults in production mode."""
        if not self.debug and self.jwt_secret_key == _INSECURE_DEFAULT:
            raise RuntimeError(
                "CRITICAL: JWT_SECRET_KEY must be set to a secure value in production. "
                "Set JWT_SECRET_KEY in your .env file or environment variables."
            )

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
