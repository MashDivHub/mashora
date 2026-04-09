"""
Shared fixtures for Mashora ERP backend unit tests.
"""
import pytest
from sqlalchemy import Integer, String, Boolean, Float, DateTime, Date
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class FakeModel(Base):
    """Test model for unit tests."""
    __tablename__ = "fake_test_table"
    __mashora_model__ = "fake.test.table"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    amount: Mapped[float] = mapped_column(Float, default=0.0)
    state: Mapped[str] = mapped_column(String, default="draft")
    partner_id: Mapped[int] = mapped_column(Integer, nullable=True)
    date_start: Mapped[str] = mapped_column(Date, nullable=True)
    create_date: Mapped[str] = mapped_column(DateTime, nullable=True)


@pytest.fixture(scope="session", autouse=True)
def _load_models():
    """Import all models and rebuild registry so tests can look up models."""
    import app.models  # noqa: F401
    from app.core.model_registry import rebuild_registry
    rebuild_registry()


@pytest.fixture
def fake_model():
    """Return the FakeModel class for use in tests."""
    return FakeModel
