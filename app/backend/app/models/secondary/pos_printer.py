"""SQLAlchemy model for pos_printer (order/receipt printer config)."""
from typing import Optional

from sqlalchemy import Integer, String, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class PosPrinter(Base, TimestampMixin):
    __tablename__ = "pos_printer"
    __mashora_model__ = "pos.printer"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    printer_type: Mapped[Optional[str]] = mapped_column(
        String, default="iot", server_default="'iot'", nullable=True
    )
    proxy_ip: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    epson_printer_ip: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    pos_config_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("pos_config.id", ondelete="SET NULL"), nullable=True
    )
    product_categories_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    def __repr__(self) -> str:
        return f"<PosPrinter id={self.id} name={self.name!r}>"
