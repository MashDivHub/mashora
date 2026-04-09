"""Unit of Measure models."""
from typing import Optional
from sqlalchemy import Boolean, Integer, Numeric, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base, TimestampMixin

class UomCategory(Base, TimestampMixin):
    __tablename__ = "uom_category"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[dict] = mapped_column(JSONB, nullable=False)

class UomUom(Base, TimestampMixin):
    __tablename__ = "uom_uom"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    sequence: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    relative_uom_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    package_type_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    name: Mapped[dict] = mapped_column(JSONB, nullable=False)
    relative_factor: Mapped[float] = mapped_column(Numeric, nullable=False)
    factor: Mapped[Optional[float]] = mapped_column(Numeric, nullable=True)
    active: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True, server_default="true")
