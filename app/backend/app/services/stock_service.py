"""
Stock/Inventory service layer.

Provides high-level operations for the stock module:
- Transfer (picking) CRUD and lifecycle
- Stock level queries (quants)
- Location and warehouse queries
- Dashboard metrics
"""
import datetime
import logging
from typing import Any, Optional

from app.services.base import (
    RecordNotFoundError,
    async_action,
    async_count,
    async_create,
    async_get,
    async_get_related,
    async_search_read,
    async_update,
)

_logger = logging.getLogger(__name__)

PICKING_LIST_FIELDS = [
    "id", "name", "state", "picking_type_id", "picking_type_code",
    "partner_id", "location_id", "location_dest_id",
    "scheduled_date", "date_deadline", "date_done",
    "origin", "move_type", "priority", "user_id",
    "company_id", "backorder_id",
]

PICKING_DETAIL_FIELDS = PICKING_LIST_FIELDS + [
    "move_ids", "move_line_ids",
    "owner_id", "note",
    "create_date", "write_date",
]

MOVE_FIELDS = [
    "id", "product_id", "name", "product_uom_qty", "quantity",
    "product_uom_id", "location_id", "location_dest_id",
    "state", "picked", "priority",
    "move_line_ids",
]

MOVE_LINE_FIELDS = [
    "id", "product_id", "quantity",
    "location_id", "location_dest_id",
    "lot_id", "lot_name",
    "package_id", "result_package_id",
    "picked", "state",
]

QUANT_FIELDS = [
    "id", "product_id", "location_id", "lot_id",
    "quantity", "reserved_quantity", "available_quantity",
    "package_id", "owner_id",
    "warehouse_id", "company_id",
    "in_date",
]

LOCATION_FIELDS = [
    "id", "name", "complete_name", "usage",
    "location_id", "warehouse_id",
    "company_id", "barcode", "active",
]

WAREHOUSE_FIELDS = [
    "id", "name", "code", "company_id", "partner_id",
    "lot_stock_id", "view_location_id",
    "reception_steps", "delivery_steps",
]


def build_picking_domain(
    picking_type_id: Optional[int] = None,
    picking_type_code: Optional[str] = None,
    state: Optional[list[str]] = None,
    partner_id: Optional[int] = None,
    date_from=None,
    date_to=None,
    search: Optional[str] = None,
) -> list:
    domain: list[Any] = []
    if picking_type_id:
        domain.append(["picking_type_id", "=", picking_type_id])
    if picking_type_code:
        domain.append(["picking_type_code", "=", picking_type_code])
    if state:
        domain.append(["state", "in", state])
    if partner_id is not None:
        domain.append(["partner_id", "=", partner_id])
    if date_from:
        domain.append(["scheduled_date", ">=", str(date_from)])
    if date_to:
        domain.append(["scheduled_date", "<=", str(date_to)])
    if search:
        domain.append("|")
        domain.append("|")
        domain.append(["name", "ilike", search])
        domain.append(["origin", "ilike", search])
        domain.append(["partner_id.name", "ilike", search])
    return domain


async def list_pickings(
    params: dict,
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict:
    domain = build_picking_domain(
        picking_type_id=params.get("picking_type_id"),
        picking_type_code=params.get("picking_type_code"),
        state=params.get("state"),
        partner_id=params.get("partner_id"),
        date_from=params.get("date_from"),
        date_to=params.get("date_to"),
        search=params.get("search"),
    )
    return await async_search_read(
        "stock.picking",
        domain=domain,
        fields=PICKING_LIST_FIELDS,
        offset=params.get("offset", 0),
        limit=params.get("limit", 40),
        order=params.get("order", "scheduled_date desc, name desc"),
    )


async def get_picking(
    picking_id: int,
    uid: int = 1,
    context: Optional[dict] = None,
) -> Optional[dict]:
    data = await async_get("stock.picking", picking_id, PICKING_DETAIL_FIELDS)
    if data is None:
        return None

    move_ids = data.get("move_ids") or []
    if move_ids:
        data["moves"] = await async_get_related(
            "stock.picking", picking_id, "picking_id", "stock.move",
            fields=MOVE_FIELDS,
        )
    else:
        data["moves"] = []

    move_line_ids = data.get("move_line_ids") or []
    if move_line_ids:
        data["move_lines"] = await async_get_related(
            "stock.picking", picking_id, "picking_id", "stock.move.line",
            fields=MOVE_LINE_FIELDS,
        )
    else:
        data["move_lines"] = []

    return data


async def create_picking(
    vals: dict,
    moves: Optional[list[dict]] = None,
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict:
    picking_vals = {k: v for k, v in vals.items() if v is not None and k != "moves"}
    record = await async_create("stock.picking", picking_vals, uid=uid, fields=PICKING_LIST_FIELDS)

    if moves:
        for move in moves:
            move_vals = {k: v for k, v in move.items() if v is not None}
            move_vals["picking_id"] = record["id"]
            await async_create("stock.move", move_vals, uid=uid, fields=MOVE_FIELDS)

    return record


async def update_picking(
    picking_id: int,
    vals: dict,
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict:
    clean_vals = {k: v for k, v in vals.items() if v is not None}
    return await async_update(
        "stock.picking", picking_id, clean_vals, uid=uid, fields=PICKING_LIST_FIELDS
    )


async def confirm_picking(picking_id: int, uid: int = 1, context: Optional[dict] = None) -> dict:
    return await async_action("stock.picking", picking_id, "state", "confirmed", uid=uid, fields=PICKING_LIST_FIELDS)


async def assign_picking(picking_id: int, uid: int = 1, context: Optional[dict] = None) -> dict:
    """Check availability / reserve stock."""
    return await async_action("stock.picking", picking_id, "state", "assigned", uid=uid, fields=PICKING_LIST_FIELDS)


async def validate_picking(picking_id: int, uid: int = 1, context: Optional[dict] = None) -> dict:
    """Validate and complete the transfer."""
    return await async_action("stock.picking", picking_id, "state", "done", uid=uid, fields=PICKING_LIST_FIELDS)


async def unreserve_picking(picking_id: int, uid: int = 1, context: Optional[dict] = None) -> dict:
    """Release reserved stock."""
    return await async_action("stock.picking", picking_id, "state", "confirmed", uid=uid, fields=PICKING_LIST_FIELDS)


async def cancel_picking(picking_id: int, uid: int = 1, context: Optional[dict] = None) -> dict:
    return await async_action("stock.picking", picking_id, "state", "cancel", uid=uid, fields=PICKING_LIST_FIELDS)


# --- Stock Quants (current stock levels) ---

async def list_quants(
    params: dict,
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict:
    domain: list[Any] = []
    if params.get("product_id"):
        domain.append(["product_id", "=", params["product_id"]])
    if params.get("location_id"):
        domain.append(["location_id", "=", params["location_id"]])
    if params.get("lot_id"):
        domain.append(["lot_id", "=", params["lot_id"]])
    if params.get("warehouse_id"):
        domain.append(["warehouse_id", "=", params["warehouse_id"]])
    if params.get("on_hand", True):
        domain.append(["quantity", ">", 0])
    if params.get("search"):
        domain.append("|")
        domain.append(["product_id.name", "ilike", params["search"]])
        domain.append(["location_id.complete_name", "ilike", params["search"]])

    return await async_search_read(
        "stock.quant",
        domain=domain,
        fields=QUANT_FIELDS,
        offset=params.get("offset", 0),
        limit=params.get("limit", 100),
        order=params.get("order", "product_id asc, location_id asc"),
    )


# --- Locations ---

async def list_locations(
    params: dict,
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict:
    domain: list[Any] = []
    if params.get("usage"):
        domain.append(["usage", "in", params["usage"]])
    if params.get("warehouse_id"):
        domain.append(["warehouse_id", "=", params["warehouse_id"]])
    if params.get("search"):
        domain.append("|")
        domain.append(["name", "ilike", params["search"]])
        domain.append(["complete_name", "ilike", params["search"]])

    return await async_search_read(
        "stock.location",
        domain=domain,
        fields=LOCATION_FIELDS,
        offset=params.get("offset", 0),
        limit=params.get("limit", 200),
        order=params.get("order", "complete_name asc"),
    )


# --- Warehouses ---

async def list_warehouses(uid: int = 1, context: Optional[dict] = None) -> dict:
    return await async_search_read(
        "stock.warehouse",
        domain=[],
        fields=WAREHOUSE_FIELDS,
        limit=1000,
    )


# --- Picking Types ---

PICKING_TYPE_FIELDS = [
    "id", "name", "code", "sequence", "warehouse_id",
    "default_location_src_id", "default_location_dest_id",
    "count_picking_draft", "count_picking_waiting",
    "count_picking_ready", "count_picking_late",
    "count_picking_backorders",
]


async def list_picking_types(uid: int = 1, context: Optional[dict] = None) -> dict:
    return await async_search_read(
        "stock.picking.type",
        domain=[],
        fields=PICKING_TYPE_FIELDS,
        limit=1000,
    )


# --- Dashboard ---

async def get_inventory_dashboard(uid: int = 1, context: Optional[dict] = None) -> dict:
    today = datetime.date.today()

    receipts_ready = await async_count(
        "stock.picking",
        [["picking_type_code", "=", "incoming"], ["state", "=", "assigned"]],
    )
    deliveries_ready = await async_count(
        "stock.picking",
        [["picking_type_code", "=", "outgoing"], ["state", "=", "assigned"]],
    )
    internal_ready = await async_count(
        "stock.picking",
        [["picking_type_code", "=", "internal"], ["state", "=", "assigned"]],
    )
    late_pickings = await async_count(
        "stock.picking",
        [
            ["state", "in", ["confirmed", "assigned", "waiting"]],
            ["scheduled_date", "<", today.isoformat()],
        ],
    )
    waiting_pickings = await async_count(
        "stock.picking",
        [["state", "in", ["confirmed", "waiting"]]],
    )

    return {
        "receipts_ready": receipts_ready,
        "deliveries_ready": deliveries_ready,
        "internal_ready": internal_ready,
        "late": late_pickings,
        "waiting": waiting_pickings,
    }


# --- Inventory Adjustments ---

INVENTORY_QUANT_FIELDS = [
    "id", "product_id", "location_id", "lot_id",
    "quantity", "reserved_quantity", "available_quantity",
    "inventory_quantity", "inventory_diff_quantity",
]


async def list_inventory_adjustments(uid=1, context=None, domain=None, offset=0, limit=50, order="product_id"):
    """List stock quants for inventory adjustment."""
    d = list(domain) if domain else []
    d.append(["location_id.usage", "=", "internal"])
    return await async_search_read(
        "stock.quant",
        domain=d,
        fields=INVENTORY_QUANT_FIELDS,
        offset=offset,
        limit=limit,
        order=order,
    )


async def set_inventory_quantity(quant_id: int, inventory_quantity: float, uid=1, context=None):
    """Set the counted quantity for an inventory adjustment."""
    return await async_update(
        "stock.quant",
        quant_id,
        {"inventory_quantity": inventory_quantity},
        uid=uid,
        fields=INVENTORY_QUANT_FIELDS,
    )


async def apply_inventory_adjustment(quant_ids: list, uid=1, context=None):
    """Apply inventory adjustments for the given quants."""
    results = []
    for qid in quant_ids:
        record = await async_action(
            "stock.quant", qid, "inventory_quantity_set", False,
            uid=uid, fields=INVENTORY_QUANT_FIELDS,
        )
        results.append(record)
    return results


# --- Scrap ---

SCRAP_FIELDS = [
    "id", "name", "product_id", "lot_id", "scrap_qty",
    "product_uom_id", "location_id", "scrap_location_id",
    "picking_id", "state", "date_done",
    "create_date", "write_date",
]


async def list_scraps(uid=1, context=None, domain=None, offset=0, limit=50, order="create_date desc"):
    d = list(domain) if domain else []
    return await async_search_read(
        "stock.scrap",
        domain=d,
        fields=SCRAP_FIELDS,
        offset=offset,
        limit=limit,
        order=order,
    )


async def create_scrap(vals: dict, uid=1, context=None):
    return await async_create("stock.scrap", vals, uid=uid, fields=SCRAP_FIELDS)


async def validate_scrap(scrap_id: int, uid=1, context=None):
    return await async_action("stock.scrap", scrap_id, "state", "done", uid=uid, fields=SCRAP_FIELDS)


# --- Returns ---

async def create_return(picking_id: int, uid=1, context=None):
    """Create a return transfer by duplicating the original picking with reversed locations."""
    data = await async_get("stock.picking", picking_id, PICKING_LIST_FIELDS)
    if data is None:
        return None

    return_vals = {
        "picking_type_id": data.get("picking_type_id"),
        "partner_id": data.get("partner_id"),
        "location_id": data.get("location_dest_id"),
        "location_dest_id": data.get("location_id"),
        "origin": data.get("name"),
        "move_type": data.get("move_type"),
    }
    return await async_create("stock.picking", return_vals, uid=uid, fields=PICKING_LIST_FIELDS)


# --- Lot/Serial Numbers ---

LOT_FIELDS = [
    "id", "name", "product_id", "company_id",
    "ref", "note", "product_qty",
    "create_date", "write_date",
]


async def list_lots(uid=1, context=None, domain=None, offset=0, limit=50, order="name"):
    d = list(domain) if domain else []
    return await async_search_read(
        "stock.lot",
        domain=d,
        fields=LOT_FIELDS,
        offset=offset,
        limit=limit,
        order=order,
    )


async def get_lot(lot_id: int, uid=1, context=None):
    return await async_get("stock.lot", lot_id, LOT_FIELDS)


async def create_lot(vals: dict, uid=1, context=None):
    return await async_create("stock.lot", vals, uid=uid, fields=LOT_FIELDS)


async def update_lot(lot_id: int, vals: dict, uid=1, context=None):
    return await async_update("stock.lot", lot_id, vals, uid=uid, fields=LOT_FIELDS)
