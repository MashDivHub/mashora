"""
Tests for configuration loading.
"""
import pytest
import os


class TestConfig:
    def test_settings_defaults(self):
        from app.config import Settings
        s = Settings()
        assert s.app_name == "Mashora ERP API"
        # Default is "mashora" but .env may override to "mashora_erp"
        assert s.mashora_db_name in ("mashora", "mashora_erp")
        assert s.jwt_algorithm == "HS256"
        assert s.orm_thread_pool_size == 8

    def test_settings_override(self):
        os.environ["MASHORA_DB_NAME"] = "test_db"
        os.environ["JWT_SECRET_KEY"] = "test-secret"
        from app.config import Settings
        s = Settings()
        assert s.mashora_db_name == "test_db"
        assert s.jwt_secret_key == "test-secret"
        # Cleanup
        del os.environ["MASHORA_DB_NAME"]
        del os.environ["JWT_SECRET_KEY"]

    def test_addons_path(self):
        from app.config import Settings
        s = Settings()
        path = s.get_addons_path()
        assert "addons" in path
