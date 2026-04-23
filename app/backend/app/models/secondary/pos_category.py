"""SQLAlchemy model for pos_category (POS product category)."""
from typing import Optional

from sqlalchemy import Integer, String, ForeignKey, LargeBinary
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class PosCategory(Base, TimestampMixin):
    __tablename__ = "pos_category"
    __mashora_model__ = "pos.category"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    parent_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("pos_category.id", ondelete="SET NULL"), nullable=True
    )
    sequence: Mapped[Optional[int]] = mapped_column(
        Integer, default=10, server_default="10", nullable=True
    )
    color: Mapped[Optional[int]] = mapped_column(
        Integer, default=0, server_default="0", nullable=True
    )
    image_128: Mapped[Optional[bytes]] = mapped_column(LargeBinary, nullable=True)

    def __repr__(self) -> str:
        return f"<PosCategory id={self.id} name={self.name!r}>"
