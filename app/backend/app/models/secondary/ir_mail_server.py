"""
SQLAlchemy model for ir_mail_server table.
"""
from typing import Optional

from sqlalchemy import Integer, String, Boolean
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class IrMailServer(Base, TimestampMixin):
    __tablename__ = "ir_mail_server"
    _registry_name = "ir.mail.server"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    sequence: Mapped[int] = mapped_column(Integer, nullable=False, default=10)

    name: Mapped[dict] = mapped_column(JSONB, nullable=False)

    smtp_host: Mapped[str] = mapped_column(String, nullable=False)
    smtp_port: Mapped[int] = mapped_column(Integer, nullable=False, default=587)
    smtp_user: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    smtp_pass: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    smtp_encryption: Mapped[str] = mapped_column(String, nullable=False, default="starttls")
    smtp_authentication: Mapped[str] = mapped_column(String, nullable=False, default="login")

    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    from_filter: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    def __repr__(self) -> str:
        return f"<IrMailServer id={self.id} smtp_host={self.smtp_host!r}>"
