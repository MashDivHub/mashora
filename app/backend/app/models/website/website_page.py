"""
SQLAlchemy model for website_page table.
"""
from typing import Optional
from datetime import datetime

from sqlalchemy import Integer, String, Boolean, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class WebsitePage(Base, TimestampMixin):
    __tablename__ = "website_page"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    website_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("website.id"), nullable=True)
    view_id: Mapped[int] = mapped_column(Integer, nullable=False)
    theme_template_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    header_color: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    header_text_color: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    url: Mapped[str] = mapped_column(String, nullable=False)

    header_visible: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    footer_visible: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    header_overlay: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    is_published: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    website_indexed: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    is_new_page_template: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)

    date_publish: Mapped[Optional[datetime]] = mapped_column(nullable=True)

    # Relationships
    website: Mapped[Optional["Website"]] = relationship("Website", back_populates="pages")

    def __repr__(self) -> str:
        return f"<WebsitePage id={self.id} url={self.url!r}>"
