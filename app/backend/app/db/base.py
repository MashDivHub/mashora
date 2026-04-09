"""
SQLAlchemy declarative base and common mixins.

All models inherit from Base. Mixins provide reusable columns
(timestamps, company_id, etc.) shared across most Mashora tables.
"""
from datetime import datetime
from typing import Annotated, Optional

from sqlalchemy import DateTime, ForeignKey, Integer, func
from sqlalchemy.orm import (
    DeclarativeBase,
    Mapped,
    mapped_column,
    declared_attr,
)


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy models."""
    pass


class TimestampMixin:
    """Mixin for create/write tracking columns present on every Mashora table."""

    create_uid: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("res_users.id", ondelete="SET NULL"), nullable=True
    )
    write_uid: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("res_users.id", ondelete="SET NULL"), nullable=True
    )
    create_date: Mapped[Optional[datetime]] = mapped_column(
        DateTime, nullable=True, server_default=func.now()
    )
    write_date: Mapped[Optional[datetime]] = mapped_column(
        DateTime, nullable=True, server_default=func.now(), onupdate=func.now()
    )


class CompanyMixin:
    """Mixin for models that belong to a company."""

    @declared_attr
    def company_id(cls) -> Mapped[Optional[int]]:
        return mapped_column(
            Integer, ForeignKey("res_company.id", ondelete="SET NULL"), nullable=True
        )


class ActiveMixin:
    """Mixin for models with an active/archive flag."""
    active: Mapped[bool] = mapped_column(default=True, server_default="true")
