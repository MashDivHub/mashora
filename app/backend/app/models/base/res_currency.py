"""
ResCurrency and ResCurrencyRate models.
Maps to: res_currency, res_currency_rate
"""
from datetime import date
from typing import Optional

from sqlalchemy import Boolean, Date, ForeignKey, Integer, Numeric, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import ActiveMixin, Base, TimestampMixin


class ResCurrency(TimestampMixin, ActiveMixin, Base):
    """Currency definition (res_currency)."""

    __tablename__ = "res_currency"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    symbol: Mapped[str] = mapped_column(String, nullable=False)
    full_name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    iso_numeric: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    decimal_places: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    rounding: Mapped[Optional[float]] = mapped_column(Numeric, nullable=True)
    position: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    # JSONB translation fields
    currency_unit_label: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    currency_subunit_label: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)

    rates: Mapped[list["ResCurrencyRate"]] = relationship(
        "ResCurrencyRate", back_populates="currency"
    )

    def __repr__(self) -> str:
        return f"<ResCurrency id={self.id} name={self.name!r}>"


class ResCurrencyRate(TimestampMixin, Base):
    """Exchange rate snapshot (res_currency_rate)."""

    __tablename__ = "res_currency_rate"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[date] = mapped_column(Date, nullable=False)
    rate: Mapped[Optional[float]] = mapped_column(Numeric, nullable=True)

    currency_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("res_currency.id", ondelete="CASCADE"), nullable=False
    )
    company_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("res_company.id", ondelete="SET NULL"), nullable=True
    )

    currency: Mapped["ResCurrency"] = relationship("ResCurrency", back_populates="rates")

    def __repr__(self) -> str:
        return f"<ResCurrencyRate id={self.id} currency_id={self.currency_id} date={self.name}>"
