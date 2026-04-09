"""
Tests for configuration loading.
"""
import pytest
import os


class TestConfig:
    def test_settings_defaults(self):
        from app.config import Settings
        s = Settings()
        assert s.app_name == "Mashora API"
        assert s.jwt_algorithm == "HS256"
        assert s.mashora_db_port == 5432

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

    def test_cors_origin_list(self):
        from app.config import Settings
        s = Settings()
        origins = s.cors_origin_list
        assert isinstance(origins, list)
        assert len(origins) > 0
