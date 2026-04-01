from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # App
    app_name: str = "Mashora Platform"
    debug: bool = False
    api_prefix: str = "/api/v1"
    public_web_url: str = "http://localhost:8069"

    # Database
    database_url: str = "postgresql+asyncpg://mashora:mashora_dev@localhost:5433/mashora_site"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # JWT
    jwt_secret_key: str = "mashora-super-secret-change-in-production"
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 30
    jwt_refresh_token_expire_days: int = 30

    # Stripe
    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""

    # MinIO
    minio_endpoint: str = "localhost:9000"
    minio_access_key: str = "minioadmin"
    minio_secret_key: str = "minioadmin"
    minio_bucket: str = "mashora-addons"

    # ERP
    erp_db_host: str = "localhost"
    erp_db_port: int = 5433
    erp_db_user: str = "mashora"
    erp_db_password: str = "mashora_dev"

    # Tenant
    tenant_default_plan: str = "free"
    tenant_provision_timeout: int = 60

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
