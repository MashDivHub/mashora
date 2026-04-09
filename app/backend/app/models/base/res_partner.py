"""
ResPartner and ResPartnerCategory models.
Maps to: res_partner, res_partner_category
"""
from typing import Optional

from sqlalchemy import Boolean, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import ActiveMixin, Base, CompanyMixin, TimestampMixin


# Many-to-many association table (category <-> partner)
# This table is managed by Odoo; we declare it for join use only.
from sqlalchemy import Table, Column
res_partner_res_partner_category_rel = Table(
    "res_partner_res_partner_category_rel",
    Base.metadata,
    Column("partner_id", Integer, ForeignKey("res_partner.id"), primary_key=True),
    Column("category_id", Integer, ForeignKey("res_partner_category.id"), primary_key=True),
)


class ResPartnerCategory(TimestampMixin, ActiveMixin, Base):
    """Partner tag / category (res_partner_category)."""

    __tablename__ = "res_partner_category"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    color: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    parent_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("res_partner_category.id", ondelete="SET NULL"), nullable=True
    )

    parent: Mapped[Optional["ResPartnerCategory"]] = relationship(
        "ResPartnerCategory", remote_side="ResPartnerCategory.id", back_populates="children"
    )
    children: Mapped[list["ResPartnerCategory"]] = relationship(
        "ResPartnerCategory", back_populates="parent"
    )

    def __repr__(self) -> str:
        return f"<ResPartnerCategory id={self.id} name={self.name!r}>"


class ResPartner(TimestampMixin, ActiveMixin, CompanyMixin, Base):
    """Contact / partner record (res_partner)."""

    __tablename__ = "res_partner"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # Basic info
    name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    complete_name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    ref: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    lang: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    tz: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    vat: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    company_registry: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    website: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    function: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    type: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    comment: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Address
    street: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    street2: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    zip: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    city: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    # Contact
    email: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    email_normalized: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    phone_sanitized: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    # Geo
    partner_latitude: Mapped[Optional[float]] = mapped_column(Numeric, nullable=True)
    partner_longitude: Mapped[Optional[float]] = mapped_column(Numeric, nullable=True)

    # Flags
    is_company: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    employee: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    partner_share: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    is_published: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    message_bounce: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    color: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    supplier_rank: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    customer_rank: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    autopost_bills: Mapped[Optional[str]] = mapped_column(String, nullable=False)
    group_rfq: Mapped[Optional[str]] = mapped_column(String, nullable=False)
    group_on: Mapped[Optional[str]] = mapped_column(String, nullable=False)

    # Company name fields
    commercial_company_name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    company_name: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    # JSONB / property fields
    properties: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    barcode: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    credit_limit: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    property_account_payable_id: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    property_account_receivable_id: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    property_account_position_id: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    property_payment_term_id: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    property_supplier_payment_term_id: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    trust: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    invoice_sending_method: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    invoice_edi_format_store: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    property_stock_customer: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    property_stock_supplier: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    specific_property_product_pricelist: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    ignore_abnormal_invoice_date: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    ignore_abnormal_invoice_amount: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    property_outbound_payment_method_line_id: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    property_inbound_payment_method_line_id: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    property_purchase_currency_id: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    receipt_reminder_email: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    reminder_date_before_receipt: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)

    # Warn messages
    picking_warn_msg: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    purchase_warn_msg: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    sale_warn_msg: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Signup / auth
    signup_type: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    # Suggest fields
    suggest_days: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    suggest_percent: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    suggest_based_on: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    # Peppol / EDI
    global_location_number: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    peppol_endpoint: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    peppol_eas: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    # Foreign keys
    parent_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("res_partner.id", ondelete="SET NULL"), nullable=True
    )
    commercial_partner_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("res_partner.id", ondelete="SET NULL"), nullable=True
    )
    user_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("res_users.id", ondelete="SET NULL"), nullable=True
    )
    state_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("res_country_state.id", ondelete="SET NULL"), nullable=True
    )
    country_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("res_country.id", ondelete="SET NULL"), nullable=True
    )
    industry_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    invoice_template_pdf_report_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    website_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    buyer_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("res_users.id", ondelete="SET NULL"), nullable=True
    )

    # Relationships
    parent: Mapped[Optional["ResPartner"]] = relationship(
        "ResPartner",
        foreign_keys=[parent_id],
        remote_side="ResPartner.id",
        back_populates="children",
    )
    children: Mapped[list["ResPartner"]] = relationship(
        "ResPartner", foreign_keys=[parent_id], back_populates="parent"
    )
    country: Mapped[Optional["ResCountry"]] = relationship(
        "ResCountry", foreign_keys=[country_id]
    )
    state: Mapped[Optional["ResCountryState"]] = relationship(
        "ResCountryState", foreign_keys=[state_id]
    )
    categories: Mapped[list["ResPartnerCategory"]] = relationship(
        "ResPartnerCategory",
        secondary=res_partner_res_partner_category_rel,
    )
    bank_accounts: Mapped[list["ResPartnerBank"]] = relationship(
        "ResPartnerBank", back_populates="partner"
    )

    def __repr__(self) -> str:
        return f"<ResPartner id={self.id} name={self.name!r}>"
