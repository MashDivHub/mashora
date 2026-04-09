"""
IrAttachment model.
Maps to: ir_attachment
"""
from typing import Optional

from sqlalchemy import Boolean, ForeignKey, Integer, LargeBinary, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, CompanyMixin, TimestampMixin


class IrAttachment(TimestampMixin, CompanyMixin, Base):
    """Binary / URL attachment linked to any record (ir_attachment)."""

    __tablename__ = "ir_attachment"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    type: Mapped[str] = mapped_column(String, nullable=False)

    # Linked record (generic many2one via res_model + res_id)
    res_model: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    res_field: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    res_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Storage
    store_fname: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    db_datas: Mapped[Optional[bytes]] = mapped_column(LargeBinary, nullable=True)
    file_size: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    checksum: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    mimetype: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    url: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    access_token: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    # Indexing / content
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    index_content: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    public: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)

    # Website / theming
    website_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    theme_template_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    key: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    original_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("ir_attachment.id", ondelete="SET NULL"), nullable=True
    )

    def __repr__(self) -> str:
        return f"<IrAttachment id={self.id} name={self.name!r} res_model={self.res_model!r}>"
