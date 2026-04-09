"""Account Payment model."""
from datetime import date
from typing import Optional
from sqlalchemy import Boolean, Date, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base, TimestampMixin

class AccountPayment(Base, TimestampMixin):
    __tablename__ = "account_payment"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    move_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    journal_id: Mapped[int] = mapped_column(Integer, nullable=False)
    company_id: Mapped[int] = mapped_column(Integer, nullable=False)
    partner_bank_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    payment_method_line_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    payment_method_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    currency_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    partner_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    outstanding_account_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    destination_account_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    paired_internal_transfer_payment_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    payment_transaction_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    payment_token_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    source_payment_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    message_main_attachment_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    state: Mapped[str] = mapped_column(String, nullable=False)
    payment_type: Mapped[str] = mapped_column(String, nullable=False)
    partner_type: Mapped[str] = mapped_column(String, nullable=False)
    memo: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    payment_reference: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    amount: Mapped[Optional[float]] = mapped_column(Numeric, nullable=True)
    amount_company_currency_signed: Mapped[Optional[float]] = mapped_column(Numeric, nullable=True)
    is_reconciled: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    is_matched: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    is_sent: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    def __repr__(self): return f"<AccountPayment(id={self.id}, name={self.name}, state={self.state})>"
