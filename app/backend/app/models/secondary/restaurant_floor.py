"""SQLAlchemy model for restaurant_floor (dining room layout)."""
from typing import Optional

from sqlalchemy import Integer, String, ForeignKey, LargeBinary
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class RestaurantFloor(Base, TimestampMixin):
    __tablename__ = "restaurant_floor"
    __mashora_model__ = "restaurant.floor"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    pos_config_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("pos_config.id", ondelete="SET NULL"), nullable=True
    )
    sequence: Mapped[Optional[int]] = mapped_column(
        Integer, default=10, server_default="10", nullable=True
    )
    background_color: Mapped[Optional[str]] = mapped_column(
        String, default="#ffffff", server_default="'#ffffff'", nullable=True
    )
    background_image: Mapped[Optional[bytes]] = mapped_column(LargeBinary, nullable=True)

    def __repr__(self) -> str:
        return f"<RestaurantFloor id={self.id} name={self.name!r}>"
