"""
ResBank and ResPartnerBank models.
Maps to: res_bank, res_partner_bank
"""
from typing import Optional

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import ActiveMixin, Base, CompanyMixin, TimestampMixin


class ResBank(TimestampMixin, ActiveMixin, Base):
    """Financial institution reference (res_bank)."""

    __tablename__ = "res_bank"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    bic: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    street: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    street2: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    zip: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    city: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    # state and country stored as raw integers (res.country.state / res.country)
    state: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    country: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    partner_banks: Mapped[list["ResPartnerBank"]] = relationship(
        "ResPartnerBank", back_populates="bank"
    )

    def __repr__(self) -> str:
        return f"<ResBank id={self.id} name={self.name!r} bic={self.bic!r}>"


class ResPartnerBank(TimestampMixin, ActiveMixin, CompanyMixin, Base):
    """Bank account linked to a partner (res_partner_bank)."""

    __tablename__ = "res_partner_bank"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    acc_number: Mapped[str] = mapped_column(String, nullable=False)
    clearing_number: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    sanitized_acc_number: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    acc_holder_name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    allow_out_payment: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    has_iban_warning: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    has_money_transfer_warning: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    sequence: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    partner_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("res_partner.id", ondelete="CASCADE"), nullable=False
    )
    bank_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("res_bank.id", ondelete="SET NULL"), nullable=True
    )
    currency_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("res_currency.id", ondelete="SET NULL"), nullable=True
    )

    partner: Mapped["ResPartner"] = relationship(
        "ResPartner", foreign_keys=[partner_id], back_populates="bank_accounts"
    )
    bank: Mapped[Optional["ResBank"]] = relationship(
        "ResBank", foreign_keys=[bank_id], back_populates="partner_banks"
    )
    currency: Mapped[Optional["ResCurrency"]] = relationship(
        "ResCurrency", foreign_keys=[currency_id]
    )

    def __repr__(self) -> str:
        return f"<ResPartnerBank id={self.id} acc_number={self.acc_number!r}>"


from app.models.base.res_partner import ResPartner  # noqa: E402, F401
from app.models.base.res_currency import ResCurrency  # noqa: E402, F401
