"""Account Analytic models."""
from datetime import date
from typing import Optional
from sqlalchemy import Boolean, Date, Float, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base, TimestampMixin

class AccountAnalyticPlan(Base, TimestampMixin):
    __tablename__ = "account_analytic_plan"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    parent_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    color: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    sequence: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    name: Mapped[dict] = mapped_column(JSONB, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

class AccountAnalyticAccount(Base, TimestampMixin):
    __tablename__ = "account_analytic_account"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    plan_id: Mapped[int] = mapped_column(Integer, nullable=False)
    root_plan_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    company_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    partner_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    code: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    name: Mapped[dict] = mapped_column(JSONB, nullable=False)
    active: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True, server_default="true")

class AccountAnalyticLine(Base, TimestampMixin):
    __tablename__ = "account_analytic_line"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    account_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    product_uom_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    partner_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    user_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    company_id: Mapped[int] = mapped_column(Integer, nullable=False)
    currency_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    product_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    general_account_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    journal_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    move_line_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    so_line: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    category: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    code: Mapped[Optional[str]] = mapped_column(String(8), nullable=True)
    ref: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    amount: Mapped[float] = mapped_column(Numeric, nullable=False)
    unit_amount: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
