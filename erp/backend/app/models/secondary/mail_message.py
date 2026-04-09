"""
SQLAlchemy models for mail_message and mail_followers tables.
"""
from typing import Optional
from datetime import datetime

from sqlalchemy import Integer, String, Text, Boolean, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class MailMessage(Base, TimestampMixin):
    __tablename__ = "mail_message"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    parent_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("mail_message.id"), nullable=True)
    res_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    record_alias_domain_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    record_company_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    subtype_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    mail_activity_type_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    author_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("res_partner.id"), nullable=True)
    author_guest_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    mail_server_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    subject: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    model: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    message_type: Mapped[str] = mapped_column(String, nullable=False)
    email_from: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    incoming_email_cc: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    outgoing_email_to: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    message_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    reply_to: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    email_layout_xmlid: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    body: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    incoming_email_to: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    is_internal: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    reply_to_force_new: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    email_add_signature: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)

    date: Mapped[Optional[datetime]] = mapped_column(nullable=True)
    pinned_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)

    # Relationships
    parent: Mapped[Optional["MailMessage"]] = relationship("MailMessage", remote_side="MailMessage.id", foreign_keys=[parent_id])
    author: Mapped[Optional["ResPartner"]] = relationship("ResPartner", foreign_keys=[author_id])

    def __repr__(self) -> str:
        return f"<MailMessage id={self.id} message_type={self.message_type!r}>"


class MailFollowers(Base):
    __tablename__ = "mail_followers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    res_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    partner_id: Mapped[int] = mapped_column(Integer, ForeignKey("res_partner.id"), nullable=False)
    res_model: Mapped[str] = mapped_column(String, nullable=False)

    # Relationships
    partner: Mapped["ResPartner"] = relationship("ResPartner", foreign_keys=[partner_id])

    def __repr__(self) -> str:
        return f"<MailFollowers id={self.id} res_model={self.res_model!r} res_id={self.res_id}>"
