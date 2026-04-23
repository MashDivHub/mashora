"""SQLAlchemy model for blog_blog (blog category/collection)."""
from typing import Optional

from sqlalchemy import Integer, String, Boolean
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class BlogBlog(Base, TimestampMixin):
    __tablename__ = "blog_blog"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    subtitle: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    active: Mapped[Optional[bool]] = mapped_column(Boolean, default=True, nullable=True)

    def __repr__(self) -> str:
        return f"<BlogBlog id={self.id} name={self.name!r}>"
