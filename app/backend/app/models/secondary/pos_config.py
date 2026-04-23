"""SQLAlchemy model for pos_config (POS register/terminal)."""
from typing import Optional

from sqlalchemy import Integer, String, Boolean, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, CompanyMixin


class PosConfig(Base, TimestampMixin, CompanyMixin):
    __tablename__ = "pos_config"
    __mashora_model__ = "pos.config"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    active: Mapped[Optional[bool]] = mapped_column(Boolean, default=True, server_default="true", nullable=True)

    currency_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("res_currency.id", ondelete="SET NULL"), nullable=True
    )
    warehouse_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("stock_warehouse.id", ondelete="SET NULL"), nullable=True
    )
    journal_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("account_journal.id", ondelete="SET NULL"), nullable=True
    )
    pricelist_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("product_pricelist.id", ondelete="SET NULL"), nullable=True
    )

    # Feature toggles
    module_pos_restaurant: Mapped[Optional[bool]] = mapped_column(
        Boolean, default=False, server_default="false", nullable=True
    )
    iface_tax_included: Mapped[Optional[str]] = mapped_column(
        String, default="subtotal", server_default="'subtotal'", nullable=True
    )
    iface_tipproduct: Mapped[Optional[bool]] = mapped_column(
        Boolean, default=False, server_default="false", nullable=True
    )
    iface_print_auto: Mapped[Optional[bool]] = mapped_column(
        Boolean, default=False, server_default="false", nullable=True
    )
    iface_cashdrawer: Mapped[Optional[bool]] = mapped_column(
        Boolean, default=False, server_default="false", nullable=True
    )
    cash_rounding: Mapped[Optional[bool]] = mapped_column(
        Boolean, default=False, server_default="false", nullable=True
    )
    limit_categories: Mapped[Optional[bool]] = mapped_column(
        Boolean, default=False, server_default="false", nullable=True
    )

    def __repr__(self) -> str:
        return f"<PosConfig id={self.id} name={self.name!r}>"
