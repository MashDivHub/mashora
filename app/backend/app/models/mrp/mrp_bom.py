"""
Bill of Materials (BoM) and BoM Line models.

Maps to PostgreSQL tables: mrp_bom, mrp_bom_line
"""
from typing import List, Optional

from sqlalchemy import Boolean, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, CompanyMixin, TimestampMixin


class MrpBom(Base, TimestampMixin, CompanyMixin):
    """Bill of Materials. Maps to mrp_bom table."""

    __tablename__ = "mrp_bom"
    __mashora_model__ = "mrp.bom"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    code: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    product_tmpl_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("product_template.id", ondelete="SET NULL"), nullable=True
    )
    product_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("product_product.id", ondelete="SET NULL"), nullable=True
    )
    product_qty: Mapped[float] = mapped_column(
        Float, nullable=False, default=1.0, server_default="1.0"
    )
    product_uom_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("uom_uom.id", ondelete="SET NULL"), nullable=True
    )
    type: Mapped[str] = mapped_column(
        String(32), nullable=False, default="normal", server_default="normal"
    )
    ready_to_produce: Mapped[str] = mapped_column(
        String(32), nullable=False, default="all_available", server_default="all_available"
    )
    sequence: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )

    # Relationships
    bom_lines: Mapped[List["MrpBomLine"]] = relationship(
        "MrpBomLine", back_populates="bom", foreign_keys="MrpBomLine.bom_id"
    )

    def __repr__(self) -> str:
        return f"<MrpBom id={self.id} code={self.code!r} type={self.type!r}>"


class MrpBomLine(Base, TimestampMixin, CompanyMixin):
    """Bill of Materials line. Maps to mrp_bom_line table."""

    __tablename__ = "mrp_bom_line"
    __mashora_model__ = "mrp.bom.line"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    bom_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("mrp_bom.id", ondelete="CASCADE"), nullable=False
    )
    product_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("product_product.id", ondelete="SET NULL"), nullable=True
    )
    product_qty: Mapped[float] = mapped_column(
        Float, nullable=False, default=1.0, server_default="1.0"
    )
    product_uom_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("uom_uom.id", ondelete="SET NULL"), nullable=True
    )
    sequence: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    operation_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Relationships
    bom: Mapped["MrpBom"] = relationship(
        "MrpBom", back_populates="bom_lines", foreign_keys=[bom_id]
    )

    def __repr__(self) -> str:
        return f"<MrpBomLine id={self.id} bom_id={self.bom_id} product_id={self.product_id}>"
