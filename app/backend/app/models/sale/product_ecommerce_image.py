"""Additional images/videos shown on the storefront product page."""
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Integer, LargeBinary, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class ProductEcommerceImage(Base, TimestampMixin):
    __tablename__ = "product_ecommerce_image"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    product_tmpl_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("product_template.id", ondelete="CASCADE"), nullable=True
    )
    product_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("product_product.id", ondelete="CASCADE"), nullable=True
    )
    sequence: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, server_default="10")
    name: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    image_1920: Mapped[Optional[bytes]] = mapped_column(LargeBinary, nullable=True)
    video_url: Mapped[Optional[str]] = mapped_column(String, nullable=True)
