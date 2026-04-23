"""
POS Restaurant service layer.

Provides CRUD operations for:
- restaurant.floor (floor/room layouts per POS config)
- restaurant.table (table placements on a floor)

Reads go through the generic async helpers (async_search_read / async_get).
Writes are performed via raw SQLAlchemy on the concrete model classes so we
keep behaviour predictable and avoid surprises from any Odoo-style ORM
plumbing.
"""
from typing import Any, Optional

from sqlalchemy import select, update as sql_update, delete as sql_delete

from app.services.base import async_get, async_search_read, get_session


FLOOR_FIELDS = [
    "id", "name", "pos_config_id", "sequence", "background_color",
]

TABLE_FIELDS = [
    "id", "name", "floor_id",
    "position_h", "position_v",
    "width", "height",
    "shape", "seats", "color", "active",
]


# ─── Floor reads ─────────────────────────────────────────────────────────────

async def list_floors(config_id: Optional[int] = None) -> dict:
    """List restaurant floors, optionally filtered by pos_config_id."""
    domain: list[Any] = []
    if config_id:
        domain.append(["pos_config_id", "=", config_id])
    return await async_search_read(
        "restaurant.floor",
        domain,
        FLOOR_FIELDS,
        limit=100,
        order="sequence, name",
    )


async def get_floor(floor_id: int) -> Optional[dict]:
    """Get a single floor with its tables embedded under `tables`."""
    floor = await async_get("restaurant.floor", floor_id, FLOOR_FIELDS)
    if floor is None:
        return None
    tables_result = await async_search_read(
        "restaurant.table",
        [["floor_id", "=", floor_id], ["active", "=", True]],
        TABLE_FIELDS,
        limit=500,
        order="name",
    )
    floor["tables"] = tables_result["records"]
    return floor


# ─── Table reads ─────────────────────────────────────────────────────────────

async def list_tables(
    floor_id: Optional[int] = None,
    active_only: bool = True,
) -> dict:
    """List restaurant tables, optionally filtered by floor_id."""
    domain: list[Any] = []
    if floor_id:
        domain.append(["floor_id", "=", floor_id])
    if active_only:
        domain.append(["active", "=", True])
    return await async_search_read(
        "restaurant.table",
        domain,
        TABLE_FIELDS,
        limit=500,
        order="floor_id, name",
    )


# ─── Raw write helpers (SQLAlchemy) ──────────────────────────────────────────

_FLOOR_COLS = {"name", "pos_config_id", "sequence", "background_color"}
_TABLE_COLS = {
    "name", "floor_id", "position_h", "position_v",
    "width", "height", "shape", "seats", "color", "active",
}


def _clean(vals: dict, allowed: set[str]) -> dict:
    return {k: v for k, v in (vals or {}).items() if k in allowed and v is not None}


async def _insert_floor(data: dict) -> int:
    from app.models.secondary.restaurant_floor import RestaurantFloor

    clean = _clean(data, _FLOOR_COLS)
    if "name" not in clean:
        raise ValueError("Floor 'name' is required")

    async with await get_session() as session:
        row = RestaurantFloor(**clean)
        session.add(row)
        await session.flush()
        await session.refresh(row)
        new_id = row.id
        await session.commit()
        return new_id


async def _update_floor(floor_id: int, data: dict) -> None:
    from app.models.secondary.restaurant_floor import RestaurantFloor

    clean = _clean(data, _FLOOR_COLS)
    if not clean:
        return

    async with await get_session() as session:
        await session.execute(
            sql_update(RestaurantFloor)
            .where(RestaurantFloor.id == floor_id)
            .values(**clean)
        )
        await session.commit()


async def _delete_floor(floor_id: int) -> None:
    from app.models.secondary.restaurant_floor import RestaurantFloor

    async with await get_session() as session:
        await session.execute(
            sql_delete(RestaurantFloor).where(RestaurantFloor.id == floor_id)
        )
        await session.commit()


async def _insert_table(data: dict) -> int:
    from app.models.secondary.restaurant_table import RestaurantTable

    clean = _clean(data, _TABLE_COLS)
    if "name" not in clean:
        raise ValueError("Table 'name' is required")
    if "floor_id" not in clean:
        raise ValueError("Table 'floor_id' is required")

    async with await get_session() as session:
        row = RestaurantTable(**clean)
        session.add(row)
        await session.flush()
        await session.refresh(row)
        new_id = row.id
        await session.commit()
        return new_id


async def _update_table(table_id: int, data: dict) -> None:
    from app.models.secondary.restaurant_table import RestaurantTable

    clean = _clean(data, _TABLE_COLS)
    if not clean:
        return

    async with await get_session() as session:
        await session.execute(
            sql_update(RestaurantTable)
            .where(RestaurantTable.id == table_id)
            .values(**clean)
        )
        await session.commit()


# ─── Floor writes ────────────────────────────────────────────────────────────

async def create_floor(data: dict) -> dict:
    """Create a floor and return its full detail (incl. empty tables list)."""
    floor_id = await _insert_floor(data)
    detail = await get_floor(floor_id)
    # get_floor returns Optional, but we just created it — fall back defensively
    return detail or {"id": floor_id, "tables": []}


async def update_floor(floor_id: int, data: dict) -> dict:
    """Update a floor and return its full detail."""
    await _update_floor(floor_id, data)
    detail = await get_floor(floor_id)
    return detail or {"id": floor_id, "tables": []}


async def delete_floor(floor_id: int) -> dict:
    """Delete a floor. Tables are removed via ON DELETE CASCADE."""
    await _delete_floor(floor_id)
    return {"success": True}


# ─── Table writes ────────────────────────────────────────────────────────────

async def create_table(data: dict) -> dict:
    """Create a table and return its data."""
    table_id = await _insert_table(data)
    record = await async_get("restaurant.table", table_id, TABLE_FIELDS)
    return record or {"id": table_id}


async def update_table(table_id: int, data: dict) -> dict:
    """Update a table and return its data."""
    await _update_table(table_id, data)
    record = await async_get("restaurant.table", table_id, TABLE_FIELDS)
    return record or {"id": table_id}


async def delete_table(table_id: int) -> dict:
    """Soft-delete a table by flipping active=False.

    This is safer than a hard delete because historical POS orders may still
    reference the table via table_id; we keep the row around so those FKs
    remain resolvable.
    """
    await _update_table(table_id, {"active": False})
    return {"success": True}
