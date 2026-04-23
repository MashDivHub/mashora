"""SQLAlchemy model for restaurant_table (table placement on a floor)."""
from typing import Optional

from sqlalchemy import Integer, String, Boolean, Float, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class RestaurantTable(Base, TimestampMixin):
    __tablename__ = "restaurant_table"
    __mashora_model__ = "restaurant.table"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    floor_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("restaurant_floor.id", ondelete="CASCADE"), nullable=False
    )
    position_h: Mapped[Optional[float]] = mapped_column(
        Float, default=0, server_default="0", nullable=True
    )
    position_v: Mapped[Optional[float]] = mapped_column(
        Float, default=0, server_default="0", nullable=True
    )
    width: Mapped[Optional[float]] = mapped_column(
        Float, default=50, server_default="50", nullable=True
    )
    height: Mapped[Optional[float]] = mapped_column(
        Float, default=50, server_default="50", nullable=True
    )
    shape: Mapped[Optional[str]] = mapped_column(
        String, default="square", server_default="'square'", nullable=True
    )
    seats: Mapped[Optional[int]] = mapped_column(
        Integer, default=1, server_default="1", nullable=True
    )
    color: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    active: Mapped[Optional[bool]] = mapped_column(
        Boolean, default=True, server_default="true", nullable=True
    )

    def __repr__(self) -> str:
        return f"<RestaurantTable id={self.id} name={self.name!r}>"
