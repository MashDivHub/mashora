"""
ResCountry and ResCountryState models.
Maps to: res_country, res_country_state
"""
from typing import Optional

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class ResCountry(TimestampMixin, Base):
    """Country reference data (res_country)."""

    __tablename__ = "res_country"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(2), nullable=False, unique=True)
    name: Mapped[dict] = mapped_column(JSONB, nullable=False)
    vat_label: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    name_position: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    phone_code: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    address_format: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    state_required: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    zip_required: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)

    address_view_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    currency_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("res_currency.id", ondelete="SET NULL"), nullable=True
    )

    currency: Mapped[Optional["ResCurrency"]] = relationship(
        "ResCurrency", foreign_keys=[currency_id]
    )
    states: Mapped[list["ResCountryState"]] = relationship(
        "ResCountryState", back_populates="country"
    )

    def __repr__(self) -> str:
        return f"<ResCountry id={self.id} code={self.code!r}>"


class ResCountryState(TimestampMixin, Base):
    """Sub-national state / province (res_country_state)."""

    __tablename__ = "res_country_state"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    code: Mapped[str] = mapped_column(String, nullable=False)

    country_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("res_country.id", ondelete="CASCADE"), nullable=False
    )

    country: Mapped["ResCountry"] = relationship("ResCountry", back_populates="states")

    def __repr__(self) -> str:
        return f"<ResCountryState id={self.id} code={self.code!r} country_id={self.country_id}>"


from app.models.base.res_currency import ResCurrency  # noqa: E402, F401
