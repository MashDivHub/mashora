"""SQLAlchemy model for pos_payment_method and pos_config_payment_method_rel join."""
from typing import Optional

from sqlalchemy import Integer, String, Boolean, ForeignKey, Table, Column
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, CompanyMixin


# m2m join table between pos_config and pos_payment_method
pos_config_payment_method_rel = Table(
    "pos_config_payment_method_rel",
    Base.metadata,
    Column(
        "config_id",
        Integer,
        ForeignKey("pos_config.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "payment_method_id",
        Integer,
        ForeignKey("pos_payment_method.id", ondelete="CASCADE"),
        primary_key=True,
    ),
)


class PosPaymentMethod(Base, TimestampMixin, CompanyMixin):
    __tablename__ = "pos_payment_method"
    __mashora_model__ = "pos.payment.method"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    active: Mapped[Optional[bool]] = mapped_column(
        Boolean, default=True, server_default="true", nullable=True
    )
    is_cash_count: Mapped[Optional[bool]] = mapped_column(
        Boolean, default=False, server_default="false", nullable=True
    )
    journal_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("account_journal.id", ondelete="SET NULL"), nullable=True
    )
    use_payment_terminal: Mapped[Optional[bool]] = mapped_column(
        Boolean, default=False, server_default="false", nullable=True
    )
    split_transactions: Mapped[Optional[bool]] = mapped_column(
        Boolean, default=False, server_default="false", nullable=True
    )
    receivable_account_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("account_account.id", ondelete="SET NULL"), nullable=True
    )
    sequence: Mapped[Optional[int]] = mapped_column(
        Integer, default=10, server_default="10", nullable=True
    )

    def __repr__(self) -> str:
        return f"<PosPaymentMethod id={self.id} name={self.name!r}>"
