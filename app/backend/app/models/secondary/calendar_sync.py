"""Calendar sync OAuth tokens and preferences."""
from datetime import datetime
from typing import Optional
from sqlalchemy import Integer, String, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base, TimestampMixin


class CalendarProvider(Base, TimestampMixin):
    """Stores OAuth credentials and sync state per user per provider."""
    __tablename__ = "calendar_provider_config"
    __mashora_model__ = "calendar.provider.config"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("res_users.id"), nullable=False)
    provider: Mapped[str] = mapped_column(String, nullable=False)  # "google" or "microsoft"

    # OAuth tokens
    access_token: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    refresh_token: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    token_expiry: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    # Sync state
    calendar_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)  # external calendar ID
    sync_token: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # incremental sync token
    last_sync: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")

    # Sync direction: "import" (external→mashora), "export" (mashora→external), "both"
    sync_direction: Mapped[str] = mapped_column(String, default="import", server_default="'import'")


class CalendarSyncLog(Base):
    """Tracks sync operations for debugging."""
    __tablename__ = "calendar_sync_log"
    __mashora_model__ = "calendar.sync.log"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    provider_config_id: Mapped[int] = mapped_column(Integer, ForeignKey("calendar_provider_config.id"), nullable=False)
    sync_date: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False)  # "success", "error", "partial"
    events_created: Mapped[int] = mapped_column(Integer, default=0)
    events_updated: Mapped[int] = mapped_column(Integer, default=0)
    events_deleted: Mapped[int] = mapped_column(Integer, default=0)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
