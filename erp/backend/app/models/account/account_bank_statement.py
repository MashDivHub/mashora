"""Account Bank Statement models."""
from datetime import date
from typing import Optional
from sqlalchemy import Boolean, Date, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base, TimestampMixin

class AccountBankStatement(Base, TimestampMixin):
    __tablename__ = "account_bank_statement"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    company_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    currency_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    journal_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    reference: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    balance_start: Mapped[Optional[float]] = mapped_column(Numeric, nullable=True)
    balance_end: Mapped[Optional[float]] = mapped_column(Numeric, nullable=True)
    balance_end_real: Mapped[Optional[float]] = mapped_column(Numeric, nullable=True)
    is_complete: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)

class AccountBankStatementLine(Base, TimestampMixin):
    __tablename__ = "account_bank_statement_line"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    move_id: Mapped[int] = mapped_column(Integer, nullable=False)
    journal_id: Mapped[int] = mapped_column(Integer, nullable=False)
    company_id: Mapped[int] = mapped_column(Integer, nullable=False)
    statement_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    partner_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    currency_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    payment_ref: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    partner_name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    amount: Mapped[Optional[float]] = mapped_column(Numeric, nullable=True)
    is_reconciled: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
