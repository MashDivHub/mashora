"""
ERP Backend Configuration.

Reads settings from environment variables or .env file.
Configures both FastAPI settings and Mashora ORM connection parameters.
"""
import os
import sys
from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # App
    app_name: str = "Mashora ERP API"
    debug: bool = False
    api_prefix: str = "/api/v1"

    # Mashora ORM
    mashora_db_name: str = "mashora"
    mashora_db_host: str = "localhost"
    mashora_db_port: int = 5432
    mashora_db_user: str = "mashora"
    mashora_db_password: str = ""
    mashora_db_maxconn: int = 16

    # Path to the Mashora root directory (parent of mashora/ package and addons/)
    mashora_root_path: str = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "..", "..")
    )

    # Addons path (comma-separated if multiple)
    mashora_addons_path: str = ""

    # JWT Auth
    jwt_secret_key: str = "mashora-erp-secret-change-in-production"
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 30
    jwt_refresh_token_expire_days: int = 30

    # Server
    host: str = "0.0.0.0"
    port: int = 8001

    # Thread pool size for ORM calls
    orm_thread_pool_size: int = 8
    orm_request_timeout: int = 30

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

    def get_addons_path(self) -> str:
        """Return the addons path, defaulting to mashora_root/addons."""
        if self.mashora_addons_path:
            return self.mashora_addons_path
        return os.path.join(self.mashora_root_path, "addons")

    def setup_mashora_path(self) -> None:
        """Add Mashora root to sys.path so `import mashora` works."""
        root = self.mashora_root_path
        if root not in sys.path:
            sys.path.insert(0, root)


@lru_cache
def get_settings() -> Settings:
    return Settings()
