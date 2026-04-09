"""
ERP Backend Configuration.

Reads settings from environment variables or .env file.
Configures FastAPI settings and SQLAlchemy connection parameters.
"""
from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # App
    app_name: str = "Mashora ERP API"
    debug: bool = False
    api_prefix: str = "/api/v1"

    # Database (SQLAlchemy async + asyncpg)
    mashora_db_name: str = "mashora_erp"
    mashora_db_host: str = "localhost"
    mashora_db_port: int = 5432
    mashora_db_user: str = "mashora"
    mashora_db_password: str = ""
    mashora_db_maxconn: int = 16

    # JWT Auth
    jwt_secret_key: str = "mashora-erp-secret-change-in-production"
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 30
    jwt_refresh_token_expire_days: int = 30

    # Server
    host: str = "0.0.0.0"
    port: int = 8001

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
