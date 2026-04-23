"""Idempotent seed script for POS default data.

Seeds payment methods, POS categories, and a default POS config so the
Point-of-Sale module is usable out of the box.

Run:
    cd app/backend && python scripts/seed_pos.py
"""

import asyncio
import asyncpg

DSN = "postgresql://mashora:mashora_dev@localhost:5432/mashora_erp"


async def seed_payment_methods(conn: asyncpg.Connection) -> int:
    count = await conn.fetchval("SELECT COUNT(*) FROM pos_payment_method")
    if count and count > 0:
        print(f"  payment methods: {count} already present, skipping")
        return count

    print("  seeding payment methods...")
    rows = [
        ("Cash", True, False, False, 10),
        ("Card", False, True, False, 20),
        ("Customer Account", False, False, True, 30),
    ]
    for name, is_cash, use_terminal, split_tx, seq in rows:
        await conn.execute(
            """
            INSERT INTO pos_payment_method
                (name, active, is_cash_count, use_payment_terminal,
                 split_transactions, sequence, create_date, write_date)
            VALUES ($1, TRUE, $2, $3, $4, $5, now(), now())
            """,
            name, is_cash, use_terminal, split_tx, seq,
        )
    return len(rows)


async def seed_categories(conn: asyncpg.Connection) -> int:
    count = await conn.fetchval("SELECT COUNT(*) FROM pos_category")
    if count and count > 0:
        print(f"  categories: {count} already present, skipping")
        return count

    print("  seeding POS categories...")
    rows = [
        ("Food", 10, 1),
        ("Drinks", 20, 2),
        ("Desserts", 30, 3),
        ("Other", 40, 0),
    ]
    for name, seq, color in rows:
        await conn.execute(
            """
            INSERT INTO pos_category
                (name, sequence, color, create_date, write_date)
            VALUES ($1, $2, $3, now(), now())
            """,
            name, seq, color,
        )
    return len(rows)


async def seed_config(conn: asyncpg.Connection) -> int | None:
    count = await conn.fetchval("SELECT COUNT(*) FROM pos_config")
    if count and count > 0:
        print(f"  pos_config: {count} already present, skipping")
        return None

    print("  seeding default POS config 'Main Register'...")
    company_id = await conn.fetchval(
        "SELECT id FROM res_company ORDER BY id LIMIT 1"
    )
    if not company_id:
        company_id = 1

    config_id = await conn.fetchval(
        """
        INSERT INTO pos_config
            (name, active, company_id, module_pos_restaurant,
             iface_tax_included, iface_tipproduct, iface_print_auto,
             iface_cashdrawer, cash_rounding, limit_categories,
             create_date, write_date)
        VALUES ($1, TRUE, $2, FALSE,
                'subtotal', FALSE, FALSE,
                FALSE, FALSE, FALSE,
                now(), now())
        RETURNING id
        """,
        "Main Register", company_id,
    )

    # Link all payment methods to this config
    await conn.execute(
        """
        INSERT INTO pos_config_payment_method_rel (config_id, payment_method_id)
        SELECT $1, id FROM pos_payment_method
        ON CONFLICT DO NOTHING
        """,
        config_id,
    )
    linked = await conn.fetchval(
        "SELECT COUNT(*) FROM pos_config_payment_method_rel WHERE config_id = $1",
        config_id,
    )
    print(f"    linked {linked} payment methods to config id={config_id}")
    return config_id


async def main() -> None:
    conn = await asyncpg.connect(DSN)
    try:
        print("Connected to mashora_erp. Seeding POS defaults...")
        pm = await seed_payment_methods(conn)
        cat = await seed_categories(conn)
        cfg = await seed_config(conn)
        print(
            f"Done. payment_methods={pm}, categories={cat}, "
            f"config_id={cfg if cfg is not None else 'skipped'}"
        )
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
