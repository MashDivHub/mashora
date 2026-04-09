"""
ResCompany model.
Maps to: res_company
"""
from datetime import date
from typing import Optional

from sqlalchemy import Boolean, Date, Double, ForeignKey, Integer, LargeBinary, Numeric, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import ActiveMixin, Base, TimestampMixin


class ResCompany(TimestampMixin, ActiveMixin, Base):
    """Company / tenant record (res_company)."""

    __tablename__ = "res_company"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # Basic
    name: Mapped[str] = mapped_column(String, nullable=False)
    sequence: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    parent_path: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    font: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    primary_color: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    secondary_color: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    layout_background: Mapped[str] = mapped_column(String, nullable=False)
    logo_web: Mapped[Optional[bytes]] = mapped_column(LargeBinary, nullable=True)
    uses_default_logo: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)

    # Social media
    social_twitter: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    social_facebook: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    social_github: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    social_linkedin: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    social_youtube: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    social_instagram: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    social_tiktok: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    social_discord: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    # Accounting
    fiscalyear_last_day: Mapped[int] = mapped_column(Integer, nullable=False)
    fiscalyear_last_month: Mapped[str] = mapped_column(String, nullable=False)
    fiscalyear_lock_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    tax_lock_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    sale_lock_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    purchase_lock_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    hard_lock_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    account_opening_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    chart_template: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    bank_account_code_prefix: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    cash_account_code_prefix: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    transfer_account_code_prefix: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    tax_calculation_rounding_method: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    terms_type: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    quick_edit_mode: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    account_price_include: Mapped[str] = mapped_column(String, nullable=False)
    expects_chart_of_accounts: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    anglo_saxon_accounting: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    qr_code: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    link_qr_code: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    display_invoice_amount_total_words: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    display_invoice_tax_company_currency: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    account_use_credit_limit: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    tax_exigibility: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    account_storno: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    restrictive_audit_trail: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    autopost_bills: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    iap_enrich_auto_done: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)

    # Snailmail
    snailmail_color: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    snailmail_cover: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    snailmail_duplex: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)

    # Email colors
    email_primary_color: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    email_secondary_color: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    # HR
    hr_presence_control_ip_list: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    hr_presence_control_email_amount: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    contract_expiration_notice_period: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    work_permit_expiration_notice_period: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    hr_presence_control_login: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    hr_presence_control_email: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    hr_presence_control_ip: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    hr_presence_control_attendance: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    employee_properties_definition: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)

    # Stock
    annual_inventory_day: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    annual_inventory_month: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    stock_confirmation_type: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    stock_move_email_validation: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    stock_text_confirmation: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    has_received_warning_stock_sms: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    horizon_days: Mapped[float] = mapped_column(Double, nullable=False)
    inventory_period: Mapped[str] = mapped_column(String, nullable=False)
    inventory_valuation: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    cost_method: Mapped[str] = mapped_column(String, nullable=False)

    # Purchase
    po_lock: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    po_double_validation: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    po_double_validation_amount: Mapped[Optional[float]] = mapped_column(Numeric, nullable=True)
    days_to_purchase: Mapped[Optional[float]] = mapped_column(Double, nullable=True)

    # Sales
    quotation_validity_days: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    sale_onboarding_payment_method: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    portal_confirmation_sign: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    portal_confirmation_pay: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    prepayment_percent: Mapped[Optional[float]] = mapped_column(Double, nullable=True)
    security_lead: Mapped[float] = mapped_column(Double, nullable=False)

    # JSONB translation fields
    report_header: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    report_footer: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    company_details: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    invoice_terms: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    invoice_terms_html: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)

    # Foreign keys
    partner_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("res_partner.id", ondelete="RESTRICT"), nullable=False
    )
    currency_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("res_currency.id", ondelete="RESTRICT"), nullable=False
    )
    parent_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("res_company.id", ondelete="SET NULL"), nullable=True
    )
    # Many other FK columns mapped as plain integers to avoid circular complexity
    paperformat_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    external_report_layout_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    nomenclature_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    resource_calendar_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    alias_domain_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    transfer_account_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    default_cash_difference_income_account_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    default_cash_difference_expense_account_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    account_journal_suspense_account_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    account_sale_tax_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    account_purchase_tax_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    currency_exchange_journal_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    income_currency_exchange_account_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    expense_currency_exchange_account_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    incoterm_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    account_opening_move_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    income_account_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    expense_account_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    price_difference_account_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    internal_transit_location_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    website_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    account_stock_journal_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    account_stock_valuation_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    account_production_wip_account_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    account_production_wip_overhead_account_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    sale_discount_product_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    downpayment_account_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    account_fiscal_country_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Relationships
    partner: Mapped["ResPartner"] = relationship("ResPartner", foreign_keys=[partner_id])
    currency: Mapped["ResCurrency"] = relationship("ResCurrency", foreign_keys=[currency_id])
    parent: Mapped[Optional["ResCompany"]] = relationship(
        "ResCompany", remote_side="ResCompany.id", back_populates="children"
    )
    children: Mapped[list["ResCompany"]] = relationship("ResCompany", back_populates="parent")

    def __repr__(self) -> str:
        return f"<ResCompany id={self.id} name={self.name!r}>"


from app.models.base.res_partner import ResPartner  # noqa: E402, F401
from app.models.base.res_currency import ResCurrency  # noqa: E402, F401
