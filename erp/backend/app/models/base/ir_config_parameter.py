"""
IrConfigParameter model.
Maps to: ir_config_parameter
"""
from sqlalchemy import Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class IrConfigParameter(TimestampMixin, Base):
    """System configuration key-value store (ir_config_parameter)."""

    __tablename__ = "ir_config_parameter"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    key: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    value: Mapped[str] = mapped_column(Text, nullable=False)

    def __repr__(self) -> str:
        return f"<IrConfigParameter id={self.id} key={self.key!r}>"
