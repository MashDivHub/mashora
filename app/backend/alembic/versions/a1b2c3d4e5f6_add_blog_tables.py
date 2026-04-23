"""add blog tables

Revision ID: a1b2c3d4e5f6
Revises:
Create Date: 2026-04-18

Creates blog_blog (category/collection) and blog_post with cover_image
binary column. Both tables include the TimestampMixin columns
(create_uid, write_uid, create_date, write_date) consistent with the
other Mashora tables.
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "a1b2c3d4e5f6"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "blog_blog",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("name", sa.String, nullable=False),
        sa.Column("subtitle", sa.String, nullable=True),
        sa.Column("active", sa.Boolean, nullable=True, server_default=sa.true()),
        sa.Column(
            "create_uid",
            sa.Integer,
            sa.ForeignKey("res_users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "write_uid",
            sa.Integer,
            sa.ForeignKey("res_users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("create_date", sa.DateTime, nullable=True, server_default=sa.func.now()),
        sa.Column("write_date", sa.DateTime, nullable=True, server_default=sa.func.now()),
    )

    op.create_table(
        "blog_post",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("name", sa.String, nullable=False),
        sa.Column("subtitle", sa.String, nullable=True),
        sa.Column(
            "author_id",
            sa.Integer,
            sa.ForeignKey("res_users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "blog_id",
            sa.Integer,
            sa.ForeignKey("blog_blog.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("content", sa.Text, nullable=True),
        sa.Column("teaser", sa.Text, nullable=True),
        sa.Column("website_published", sa.Boolean, nullable=True, server_default=sa.false()),
        sa.Column("post_date", sa.DateTime, nullable=True),
        sa.Column("visits", sa.Integer, nullable=True, server_default="0"),
        sa.Column("cover_image", sa.LargeBinary, nullable=True),
        sa.Column(
            "create_uid",
            sa.Integer,
            sa.ForeignKey("res_users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "write_uid",
            sa.Integer,
            sa.ForeignKey("res_users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("create_date", sa.DateTime, nullable=True, server_default=sa.func.now()),
        sa.Column("write_date", sa.DateTime, nullable=True, server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("blog_post")
    op.drop_table("blog_blog")
