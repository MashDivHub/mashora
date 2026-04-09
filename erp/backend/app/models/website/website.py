"""
SQLAlchemy model for website table.
"""
from typing import Optional

from sqlalchemy import Integer, String, Text, Boolean, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, CompanyMixin


class Website(Base, TimestampMixin, CompanyMixin):
    __tablename__ = "website"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    sequence: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    default_lang_id: Mapped[int] = mapped_column(Integer, nullable=False)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("res_users.id"), nullable=False)
    theme_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    crm_default_team_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    crm_default_user_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    name: Mapped[str] = mapped_column(String, nullable=False)
    domain: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    social_twitter: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    social_facebook: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    social_github: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    social_linkedin: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    social_youtube: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    social_instagram: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    social_tiktok: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    social_discord: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    google_analytics_key: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    google_search_console: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    google_maps_api_key: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    plausible_shared_key: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    plausible_site: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    cdn_url: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    homepage_url: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    auth_signup_uninvited: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    custom_blocked_third_party_domains: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    cdn_filters: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    custom_code_head: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    custom_code_footer: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    robots_txt: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    auto_redirect_lang: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    cookies_bar: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    configurator_done: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    block_third_party_domains: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    has_social_default_image: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    cdn_activated: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    specific_user_account: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)

    # Relationships
    pages: Mapped[list["WebsitePage"]] = relationship("WebsitePage", back_populates="website")

    def __repr__(self) -> str:
        return f"<Website id={self.id} name={self.name!r}>"
