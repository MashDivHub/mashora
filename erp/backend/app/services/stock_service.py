"""
Stock/Inventory service layer.

Provides high-level operations for the stock module:
- Transfer (picking) CRUD and lifecycle
- Stock level queries (quants)
- Location and warehouse queries
- Dashboard metrics
"""
import logging
from typing import Any, Optional

from app.core.orm_adapter import mashora_env

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
    if partner_id:
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


def list_pickings(
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
    with mashora_env(uid=uid, context=context) as env:
        Picking = env["stock.picking"]
        total = Picking.search_count(domain)
        records = Picking.search(
            domain,
            offset=params.get("offset", 0),
            limit=params.get("limit", 40),
            order=params.get("order", "scheduled_date desc, name desc"),
        )
        return {"records": records.read(PICKING_LIST_FIELDS), "total": total}


def get_picking(
    picking_id: int,
    uid: int = 1,
    context: Optional[dict] = None,
) -> Optional[dict]:
    with mashora_env(uid=uid, context=context) as env:
        picking = env["stock.picking"].browse(picking_id)
        if not picking.exists():
            return None
        data = picking.read(PICKING_DETAIL_FIELDS)[0]

        move_ids = data.get("move_ids", [])
        if move_ids:
            moves = env["stock.move"].browse(move_ids)
            data["moves"] = moves.read(MOVE_FIELDS)
        else:
            data["moves"] = []

        move_line_ids = data.get("move_line_ids", [])
        if move_line_ids:
            move_lines = env["stock.move.line"].browse(move_line_ids)
            data["move_lines"] = move_lines.read(MOVE_LINE_FIELDS)
        else:
            data["move_lines"] = []

        return data


def create_picking(
    vals: dict,
    moves: Optional[list[dict]] = None,
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict:
    with mashora_env(uid=uid, context=context) as env:
        picking_vals = {k: v for k, v in vals.items() if v is not None and k != "moves"}

        if moves:
            picking_vals["move_ids"] = []
            for move in moves:
                move_vals = {k: v for k, v in move.items() if v is not None}
                picking_vals["move_ids"].append((0, 0, move_vals))

        picking = env["stock.picking"].create(picking_vals)
        return picking.read(PICKING_LIST_FIELDS)[0]


def update_picking(
    picking_id: int,
    vals: dict,
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict:
    with mashora_env(uid=uid, context=context) as env:
        picking = env["stock.picking"].browse(picking_id)
        if not picking.exists():
            from mashora.exceptions import MissingError
            raise MissingError(f"Transfer {picking_id} not found")
        clean_vals = {k: v for k, v in vals.items() if v is not None}
        picking.write(clean_vals)
        return picking.read(PICKING_LIST_FIELDS)[0]


def confirm_picking(picking_id: int, uid: int = 1, context: Optional[dict] = None) -> dict:
    with mashora_env(uid=uid, context=context) as env:
        picking = env["stock.picking"].browse(picking_id)
        picking.action_confirm()
        return picking.read(PICKING_LIST_FIELDS)[0]


def assign_picking(picking_id: int, uid: int = 1, context: Optional[dict] = None) -> dict:
    """Check availability / reserve stock."""
    with mashora_env(uid=uid, context=context) as env:
        picking = env["stock.picking"].browse(picking_id)
        picking.action_assign()
        return picking.read(PICKING_LIST_FIELDS)[0]


def validate_picking(picking_id: int, uid: int = 1, context: Optional[dict] = None) -> dict:
    """Validate and complete the transfer."""
    with mashora_env(uid=uid, context=context) as env:
        picking = env["stock.picking"].browse(picking_id)
        picking.button_validate()
        return picking.read(PICKING_LIST_FIELDS)[0]


def unreserve_picking(picking_id: int, uid: int = 1, context: Optional[dict] = None) -> dict:
    """Release reserved stock."""
    with mashora_env(uid=uid, context=context) as env:
        picking = env["stock.picking"].browse(picking_id)
        picking.do_unreserve()
        return picking.read(PICKING_LIST_FIELDS)[0]


def cancel_picking(picking_id: int, uid: int = 1, context: Optional[dict] = None) -> dict:
    with mashora_env(uid=uid, context=context) as env:
        picking = env["stock.picking"].browse(picking_id)
        picking.action_cancel()
        return picking.read(PICKING_LIST_FIELDS)[0]


# --- Stock Quants (current stock levels) ---

def list_quants(
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

    with mashora_env(uid=uid, context=context) as env:
        Quant = env["stock.quant"]
        total = Quant.search_count(domain)
        records = Quant.search(
            domain,
            offset=params.get("offset", 0),
            limit=params.get("limit", 100),
            order=params.get("order", "product_id asc, location_id asc"),
        )
        return {"records": records.read(QUANT_FIELDS), "total": total}


# --- Locations ---

def list_locations(
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

    with mashora_env(uid=uid, context=context) as env:
        Location = env["stock.location"]
        total = Location.search_count(domain)
        records = Location.search(
            domain,
            offset=params.get("offset", 0),
            limit=params.get("limit", 200),
            order=params.get("order", "complete_name asc"),
        )
        return {"records": records.read(LOCATION_FIELDS), "total": total}


# --- Warehouses ---

def list_warehouses(uid: int = 1, context: Optional[dict] = None) -> dict:
    with mashora_env(uid=uid, context=context) as env:
        Warehouse = env["stock.warehouse"]
        records = Warehouse.search([])
        return {"records": records.read(WAREHOUSE_FIELDS), "total": len(records)}


# --- Picking Types ---

def list_picking_types(uid: int = 1, context: Optional[dict] = None) -> dict:
    with mashora_env(uid=uid, context=context) as env:
        PickingType = env["stock.picking.type"]
        records = PickingType.search([])
        data = records.read([
            "id", "name", "code", "sequence", "warehouse_id",
            "default_location_src_id", "default_location_dest_id",
            "count_picking_draft", "count_picking_waiting",
            "count_picking_ready", "count_picking_late",
            "count_picking_backorders",
        ])
        return {"records": data, "total": len(data)}


# --- Dashboard ---

def get_inventory_dashboard(uid: int = 1, context: Optional[dict] = None) -> dict:
    with mashora_env(uid=uid, context=context) as env:
        Picking = env["stock.picking"]

        receipts_ready = Picking.search_count([
            ("picking_type_code", "=", "incoming"),
            ("state", "=", "assigned"),
        ])
        deliveries_ready = Picking.search_count([
            ("picking_type_code", "=", "outgoing"),
            ("state", "=", "assigned"),
        ])
        internal_ready = Picking.search_count([
            ("picking_type_code", "=", "internal"),
            ("state", "=", "assigned"),
        ])

        import datetime
        today = datetime.date.today()
        late_pickings = Picking.search_count([
            ("state", "in", ["confirmed", "assigned", "waiting"]),
            ("scheduled_date", "<", today.isoformat()),
        ])

        waiting_pickings = Picking.search_count([
            ("state", "in", ["confirmed", "waiting"]),
        ])

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


def list_inventory_adjustments(uid=1, context=None, domain=None, offset=0, limit=50, order="product_id"):
    """List stock quants for inventory adjustment."""
    with mashora_env(uid=uid, context=context) as env:
        d = list(domain) if domain else []
        d.append(('location_id.usage', '=', 'internal'))
        total = env['stock.quant'].search_count(d)
        records = env['stock.quant'].search(d, offset=offset, limit=limit, order=order)
        data = records.read(INVENTORY_QUANT_FIELDS)
        return {"records": data, "total": total}


def set_inventory_quantity(quant_id: int, inventory_quantity: float, uid=1, context=None):
    """Set the counted quantity for an inventory adjustment."""
    with mashora_env(uid=uid, context=context) as env:
        quant = env['stock.quant'].browse(quant_id)
        quant.write({'inventory_quantity': inventory_quantity})
        return quant.read(INVENTORY_QUANT_FIELDS)[0]


def apply_inventory_adjustment(quant_ids: list, uid=1, context=None):
    """Apply inventory adjustments for the given quants."""
    with mashora_env(uid=uid, context=context) as env:
        quants = env['stock.quant'].browse(quant_ids)
        quants.action_apply_inventory()
        return quants.read(INVENTORY_QUANT_FIELDS)


# --- Scrap ---

SCRAP_FIELDS = [
    "id", "name", "product_id", "lot_id", "scrap_qty",
    "product_uom_id", "location_id", "scrap_location_id",
    "picking_id", "state", "date_done",
    "create_date", "write_date",
]


def list_scraps(uid=1, context=None, domain=None, offset=0, limit=50, order="create_date desc"):
    with mashora_env(uid=uid, context=context) as env:
        d = list(domain) if domain else []
        total = env['stock.scrap'].search_count(d)
        records = env['stock.scrap'].search(d, offset=offset, limit=limit, order=order)
        data = records.read(SCRAP_FIELDS)
        return {"records": data, "total": total}


def create_scrap(vals: dict, uid=1, context=None):
    with mashora_env(uid=uid, context=context) as env:
        record = env['stock.scrap'].create(vals)
        return record.read(SCRAP_FIELDS)[0]


def validate_scrap(scrap_id: int, uid=1, context=None):
    with mashora_env(uid=uid, context=context) as env:
        scrap = env['stock.scrap'].browse(scrap_id)
        scrap.action_validate()
        return scrap.read(SCRAP_FIELDS)[0]


# --- Returns ---

def create_return(picking_id: int, uid=1, context=None):
    """Create a return transfer using the return wizard."""
    with mashora_env(uid=uid, context=context) as env:
        picking = env['stock.picking'].browse(picking_id)
        if not picking.exists():
            return None
        ctx = dict(env.context, active_id=picking_id, active_ids=[picking_id], active_model='stock.picking')
        wizard = env['stock.return.picking'].with_context(ctx).create({})
        result = wizard.action_create_returns()
        if isinstance(result, dict) and result.get('res_id'):
            new_picking = env['stock.picking'].browse(result['res_id'])
            return new_picking.read(PICKING_LIST_FIELDS)[0]
        return result


# --- Lot/Serial Numbers ---

LOT_FIELDS = [
    "id", "name", "product_id", "company_id",
    "ref", "note", "product_qty",
    "create_date", "write_date",
]


def list_lots(uid=1, context=None, domain=None, offset=0, limit=50, order="name"):
    with mashora_env(uid=uid, context=context) as env:
        d = list(domain) if domain else []
        total = env['stock.lot'].search_count(d)
        records = env['stock.lot'].search(d, offset=offset, limit=limit, order=order)
        data = records.read(LOT_FIELDS)
        return {"records": data, "total": total}


def get_lot(lot_id: int, uid=1, context=None):
    with mashora_env(uid=uid, context=context) as env:
        record = env['stock.lot'].browse(lot_id)
        if not record.exists():
            return None
        return record.read(LOT_FIELDS)[0]


def create_lot(vals: dict, uid=1, context=None):
    with mashora_env(uid=uid, context=context) as env:
        record = env['stock.lot'].create(vals)
        return record.read(LOT_FIELDS)[0]


def update_lot(lot_id: int, vals: dict, uid=1, context=None):
    with mashora_env(uid=uid, context=context) as env:
        record = env['stock.lot'].browse(lot_id)
        record.write(vals)
        return record.read(LOT_FIELDS)[0]
