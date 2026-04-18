"""Subscriptions / recurring sales orders."""
from datetime import date, datetime
from typing import Optional
from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base, TimestampMixin, CompanyMixin, ActiveMixin


class SaleSubscriptionTemplate(Base, TimestampMixin, CompanyMixin, ActiveMixin):
    __tablename__ = "sale_subscription_template"
    __mashora_model__ = "sale.subscription.template"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    code: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    recurring_rule_type: Mapped[str] = mapped_column(String, default="month", server_default="'month'")  # day/week/month/year
    recurring_interval: Mapped[int] = mapped_column(Integer, default=1, server_default="1")
    auto_close_limit: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)


class SaleSubscription(Base, TimestampMixin, CompanyMixin, ActiveMixin):
    __tablename__ = "sale_subscription"
    __mashora_model__ = "sale.subscription"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    code: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    partner_id: Mapped[int] = mapped_column(Integer, ForeignKey("res_partner.id"), nullable=False)
    template_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("sale_subscription_template.id"), nullable=True)
    user_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("res_users.id"), nullable=True)
    pricelist_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    currency_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    date_start: Mapped[date] = mapped_column(Date, nullable=False)
    date_end: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    next_invoice_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    recurring_rule_type: Mapped[str] = mapped_column(String, default="month", server_default="'month'")
    recurring_interval: Mapped[int] = mapped_column(Integer, default=1, server_default="1")
    state: Mapped[str] = mapped_column(String, default="draft", server_default="'draft'")  # draft/in_progress/paused/closed/cancel
    recurring_total: Mapped[Optional[float]] = mapped_column(Numeric, nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)


class SaleSubscriptionLine(Base, TimestampMixin):
    __tablename__ = "sale_subscription_line"
    __mashora_model__ = "sale.subscription.line"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    subscription_id: Mapped[int] = mapped_column(Integer, ForeignKey("sale_subscription.id", ondelete="CASCADE"), nullable=False)
    product_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("product_product.id"), nullable=True)
    name: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    quantity: Mapped[float] = mapped_column(Numeric, default=1.0, server_default="1.0")
    price_unit: Mapped[Optional[float]] = mapped_column(Numeric, nullable=True)
    discount: Mapped[Optional[float]] = mapped_column(Numeric, nullable=True)
    price_subtotal: Mapped[Optional[float]] = mapped_column(Numeric, nullable=True)
