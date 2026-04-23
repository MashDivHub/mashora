"""add pos tables

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-04-20

Creates the full POS schema: pos_config, pos_payment_method,
pos_config_payment_method_rel (m2m), pos_category, pos_session, pos_order,
pos_order_line, pos_payment, restaurant_floor, restaurant_table, pos_printer.

All tables include the TimestampMixin columns (create_uid, write_uid,
create_date, write_date). CompanyMixin tables also carry company_id.
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "b2c3d4e5f6a7"
down_revision = "a1b2c3d4e5f6"
branch_labels = None
depends_on = None


def _timestamp_columns():
    """Standard TimestampMixin columns for every Mashora table."""
    return [
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
    ]


def _company_column():
    return sa.Column(
        "company_id",
        sa.Integer,
        sa.ForeignKey("res_company.id", ondelete="SET NULL"),
        nullable=True,
    )


def upgrade() -> None:
    # 1. pos_category (self-reference)
    op.create_table(
        "pos_category",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("name", sa.String, nullable=False),
        sa.Column(
            "parent_id",
            sa.Integer,
            sa.ForeignKey("pos_category.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("sequence", sa.Integer, nullable=True, server_default="10"),
        sa.Column("color", sa.Integer, nullable=True, server_default="0"),
        sa.Column("image_128", sa.LargeBinary, nullable=True),
        *_timestamp_columns(),
    )

    # 2. pos_payment_method
    op.create_table(
        "pos_payment_method",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("name", sa.String, nullable=False),
        sa.Column("active", sa.Boolean, nullable=True, server_default=sa.true()),
        _company_column(),
        sa.Column("is_cash_count", sa.Boolean, nullable=True, server_default=sa.false()),
        sa.Column(
            "journal_id",
            sa.Integer,
            sa.ForeignKey("account_journal.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "use_payment_terminal", sa.Boolean, nullable=True, server_default=sa.false()
        ),
        sa.Column(
            "split_transactions", sa.Boolean, nullable=True, server_default=sa.false()
        ),
        sa.Column(
            "receivable_account_id",
            sa.Integer,
            sa.ForeignKey("account_account.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("sequence", sa.Integer, nullable=True, server_default="10"),
        *_timestamp_columns(),
    )

    # 3. pos_config
    op.create_table(
        "pos_config",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("name", sa.String, nullable=False),
        sa.Column("active", sa.Boolean, nullable=True, server_default=sa.true()),
        _company_column(),
        sa.Column(
            "currency_id",
            sa.Integer,
            sa.ForeignKey("res_currency.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "warehouse_id",
            sa.Integer,
            sa.ForeignKey("stock_warehouse.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "journal_id",
            sa.Integer,
            sa.ForeignKey("account_journal.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "pricelist_id",
            sa.Integer,
            sa.ForeignKey("product_pricelist.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "module_pos_restaurant", sa.Boolean, nullable=True, server_default=sa.false()
        ),
        sa.Column(
            "iface_tax_included", sa.String, nullable=True, server_default="subtotal"
        ),
        sa.Column("iface_tipproduct", sa.Boolean, nullable=True, server_default=sa.false()),
        sa.Column(
            "iface_print_auto", sa.Boolean, nullable=True, server_default=sa.false()
        ),
        sa.Column(
            "iface_cashdrawer", sa.Boolean, nullable=True, server_default=sa.false()
        ),
        sa.Column("cash_rounding", sa.Boolean, nullable=True, server_default=sa.false()),
        sa.Column(
            "limit_categories", sa.Boolean, nullable=True, server_default=sa.false()
        ),
        *_timestamp_columns(),
    )

    # 4. pos_config_payment_method_rel (m2m)
    op.create_table(
        "pos_config_payment_method_rel",
        sa.Column(
            "config_id",
            sa.Integer,
            sa.ForeignKey("pos_config.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "payment_method_id",
            sa.Integer,
            sa.ForeignKey("pos_payment_method.id", ondelete="CASCADE"),
            primary_key=True,
        ),
    )

    # 5. pos_session
    op.create_table(
        "pos_session",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("name", sa.String, nullable=False),
        sa.Column(
            "config_id",
            sa.Integer,
            sa.ForeignKey("pos_config.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            sa.Integer,
            sa.ForeignKey("res_users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        _company_column(),
        sa.Column("state", sa.String, nullable=True, server_default="opening_control"),
        sa.Column("start_at", sa.DateTime, nullable=True),
        sa.Column("stop_at", sa.DateTime, nullable=True),
        sa.Column(
            "cash_register_balance_start", sa.Float, nullable=True, server_default="0"
        ),
        sa.Column(
            "cash_register_balance_end_real", sa.Float, nullable=True, server_default="0"
        ),
        sa.Column(
            "cash_register_balance_end", sa.Float, nullable=True, server_default="0"
        ),
        sa.Column("cash_control", sa.Boolean, nullable=True, server_default=sa.false()),
        sa.Column("cash_journal_id", sa.Integer, nullable=True),
        sa.Column("rescue", sa.Boolean, nullable=True, server_default=sa.false()),
        sa.Column("sequence_number", sa.Integer, nullable=True, server_default="1"),
        sa.Column("login_number", sa.Integer, nullable=True, server_default="0"),
        sa.Column("opening_notes", sa.Text, nullable=True),
        sa.Column("closing_notes", sa.Text, nullable=True),
        *_timestamp_columns(),
    )

    # 6. restaurant_floor
    op.create_table(
        "restaurant_floor",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("name", sa.String, nullable=False),
        sa.Column(
            "pos_config_id",
            sa.Integer,
            sa.ForeignKey("pos_config.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("sequence", sa.Integer, nullable=True, server_default="10"),
        sa.Column(
            "background_color", sa.String, nullable=True, server_default="#ffffff"
        ),
        sa.Column("background_image", sa.LargeBinary, nullable=True),
        *_timestamp_columns(),
    )

    # 7. restaurant_table
    op.create_table(
        "restaurant_table",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("name", sa.String, nullable=False),
        sa.Column(
            "floor_id",
            sa.Integer,
            sa.ForeignKey("restaurant_floor.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("position_h", sa.Float, nullable=True, server_default="0"),
        sa.Column("position_v", sa.Float, nullable=True, server_default="0"),
        sa.Column("width", sa.Float, nullable=True, server_default="50"),
        sa.Column("height", sa.Float, nullable=True, server_default="50"),
        sa.Column("shape", sa.String, nullable=True, server_default="square"),
        sa.Column("seats", sa.Integer, nullable=True, server_default="1"),
        sa.Column("color", sa.String, nullable=True),
        sa.Column("active", sa.Boolean, nullable=True, server_default=sa.true()),
        *_timestamp_columns(),
    )

    # 8. pos_order (depends on session, config, restaurant_table)
    op.create_table(
        "pos_order",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("name", sa.String, nullable=False),
        sa.Column("pos_reference", sa.String, nullable=True),
        sa.Column(
            "session_id",
            sa.Integer,
            sa.ForeignKey("pos_session.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "config_id",
            sa.Integer,
            sa.ForeignKey("pos_config.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "user_id",
            sa.Integer,
            sa.ForeignKey("res_users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "partner_id",
            sa.Integer,
            sa.ForeignKey("res_partner.id", ondelete="SET NULL"),
            nullable=True,
        ),
        _company_column(),
        sa.Column("date_order", sa.DateTime, nullable=True, server_default=sa.func.now()),
        sa.Column("state", sa.String, nullable=True, server_default="draft"),
        sa.Column("amount_total", sa.Float, nullable=True, server_default="0"),
        sa.Column("amount_tax", sa.Float, nullable=True, server_default="0"),
        sa.Column("amount_paid", sa.Float, nullable=True, server_default="0"),
        sa.Column("amount_return", sa.Float, nullable=True, server_default="0"),
        sa.Column("note", sa.Text, nullable=True),
        sa.Column(
            "pricelist_id",
            sa.Integer,
            sa.ForeignKey("product_pricelist.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("fiscal_position_id", sa.Integer, nullable=True),
        sa.Column(
            "table_id",
            sa.Integer,
            sa.ForeignKey("restaurant_table.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("customer_count", sa.Integer, nullable=True, server_default="1"),
        sa.Column("tracking_number", sa.String, nullable=True),
        *_timestamp_columns(),
    )

    # 9. pos_order_line
    op.create_table(
        "pos_order_line",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column(
            "order_id",
            sa.Integer,
            sa.ForeignKey("pos_order.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "product_id",
            sa.Integer,
            sa.ForeignKey("product_product.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("name", sa.String, nullable=False),
        sa.Column("qty", sa.Float, nullable=True, server_default="1"),
        sa.Column("price_unit", sa.Float, nullable=True, server_default="0"),
        sa.Column("price_subtotal", sa.Float, nullable=True, server_default="0"),
        sa.Column("price_subtotal_incl", sa.Float, nullable=True, server_default="0"),
        sa.Column("discount", sa.Float, nullable=True, server_default="0"),
        sa.Column("tax_ids_json", sa.Text, nullable=True),
        sa.Column("note", sa.Text, nullable=True),
        sa.Column("sequence", sa.Integer, nullable=True, server_default="10"),
        *_timestamp_columns(),
    )

    # 10. pos_payment
    op.create_table(
        "pos_payment",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column(
            "pos_order_id",
            sa.Integer,
            sa.ForeignKey("pos_order.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "payment_method_id",
            sa.Integer,
            sa.ForeignKey("pos_payment_method.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("amount", sa.Float, nullable=False),
        sa.Column(
            "payment_date", sa.DateTime, nullable=True, server_default=sa.func.now()
        ),
        sa.Column("card_type", sa.String, nullable=True),
        sa.Column("transaction_id", sa.String, nullable=True),
        sa.Column("ticket", sa.Text, nullable=True),
        *_timestamp_columns(),
    )

    # 11. pos_printer
    op.create_table(
        "pos_printer",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("name", sa.String, nullable=False),
        sa.Column("printer_type", sa.String, nullable=True, server_default="iot"),
        sa.Column("proxy_ip", sa.String, nullable=True),
        sa.Column("epson_printer_ip", sa.String, nullable=True),
        sa.Column(
            "pos_config_id",
            sa.Integer,
            sa.ForeignKey("pos_config.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("product_categories_json", sa.Text, nullable=True),
        *_timestamp_columns(),
    )


def downgrade() -> None:
    op.drop_table("pos_printer")
    op.drop_table("pos_payment")
    op.drop_table("pos_order_line")
    op.drop_table("pos_order")
    op.drop_table("restaurant_table")
    op.drop_table("restaurant_floor")
    op.drop_table("pos_session")
    op.drop_table("pos_config_payment_method_rel")
    op.drop_table("pos_config")
    op.drop_table("pos_payment_method")
    op.drop_table("pos_category")
