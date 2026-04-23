"""SQLAlchemy model for blog_post with cover_image support."""
from datetime import datetime
from typing import Optional

from sqlalchemy import Integer, String, Text, Boolean, ForeignKey, LargeBinary, DateTime
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class BlogPost(Base, TimestampMixin):
    __tablename__ = "blog_post"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    subtitle: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    author_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("res_users.id", ondelete="SET NULL"), nullable=True
    )
    blog_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("blog_blog.id", ondelete="SET NULL"), nullable=True
    )
    content: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    teaser: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    website_published: Mapped[Optional[bool]] = mapped_column(Boolean, default=False, nullable=True)
    post_date: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    visits: Mapped[Optional[int]] = mapped_column(Integer, default=0, nullable=True)
    cover_image: Mapped[Optional[bytes]] = mapped_column(LargeBinary, nullable=True)

    def __repr__(self) -> str:
        return f"<BlogPost id={self.id} name={self.name!r}>"
