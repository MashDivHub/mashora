"""Account Reconcile models."""
from sqlalchemy import Integer
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base, TimestampMixin

class AccountPartialReconcile(Base, TimestampMixin):
    __tablename__ = "account_partial_reconcile"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

class AccountFullReconcile(Base, TimestampMixin):
    __tablename__ = "account_full_reconcile"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
