"""Daily operations dashboard — aggregate sales, purchases, cash/bank, transfers for a date."""
from datetime import date as _date, datetime, timedelta
from typing import Any

from app.services.base import async_search_read, async_count


async def _journal_ids_by_type(types: list[str]) -> list[int]:
    result = await async_search_read(
        "account.journal",
        domain=[["type", "in", types]],
        fields=["id"],
        limit=200,
    )
    return [r["id"] for r in result.get("records", [])]


async def _sum_field(model: str, field: str, domain: list, limit: int = 5000) -> tuple[float, int]:
    """Return (sum, count) of a numeric field over a domain. Cheap for small result sets."""
    result = await async_search_read(model, domain=domain, fields=["id", field], limit=limit)
    records = result.get("records", [])
    total = 0.0
    for r in records:
        v = r.get(field)
        if isinstance(v, (int, float)):
            total += float(v)
    return total, len(records)


async def get_daily_activity(day: str | None = None, days: int = 1) -> dict:
    """Aggregate activity for a date range ending on `day` (inclusive).

    days=1 → just that day; days=7 → last 7 days ending on day; etc.
    """
    target = _date.fromisoformat(day) if day else _date.today()
    start = target - timedelta(days=max(0, days - 1))
    start_s = start.isoformat()
    end_s = target.isoformat()
    # Datetime bounds: use datetime objects so the domain parser doesn't have to coerce
    start_dt = datetime.combine(start, datetime.min.time())
    end_dt = datetime.combine(target, datetime.max.time().replace(microsecond=0))

    # --- Sales orders confirmed in range (date_order) ---
    sale_total, sale_count = await _sum_field(
        "sale.order", "amount_total",
        [["date_order", ">=", start_dt], ["date_order", "<=", end_dt], ["state", "in", ["sale", "done"]]],
    )

    # --- Purchase orders confirmed in range ---
    purchase_total, purchase_count = await _sum_field(
        "purchase.order", "amount_total",
        [["date_order", ">=", start_dt], ["date_order", "<=", end_dt], ["state", "in", ["purchase", "done"]]],
    )

    # --- Customer invoices posted in range ---
    invoice_total, invoice_count = await _sum_field(
        "account.move", "amount_total",
        [["date", ">=", start_s], ["date", "<=", end_s], ["state", "=", "posted"], ["move_type", "=", "out_invoice"]],
    )
    # --- Vendor bills posted in range ---
    bill_total, bill_count = await _sum_field(
        "account.move", "amount_total",
        [["date", ">=", start_s], ["date", "<=", end_s], ["state", "=", "posted"], ["move_type", "=", "in_invoice"]],
    )

    # --- Cash/Bank: deposits (inbound payments) + withdrawals (outbound) in range ---
    bank_journal_ids = await _journal_ids_by_type(["bank", "cash"])
    if bank_journal_ids:
        deposits_total, deposits_count = await _sum_field(
            "account.payment", "amount",
            [["date", ">=", start_s], ["date", "<=", end_s], ["state", "=", "posted"],
             ["payment_type", "=", "inbound"], ["journal_id", "in", bank_journal_ids]],
        )
        withdrawals_total, withdrawals_count = await _sum_field(
            "account.payment", "amount",
            [["date", ">=", start_s], ["date", "<=", end_s], ["state", "=", "posted"],
             ["payment_type", "=", "outbound"], ["journal_id", "in", bank_journal_ids]],
        )
    else:
        deposits_total = withdrawals_total = 0.0
        deposits_count = withdrawals_count = 0

    # --- Inventory transfers done in range ---
    receipts_count = await async_count(
        "stock.picking",
        domain=[["date_done", ">=", start_dt], ["date_done", "<=", end_dt],
                ["state", "=", "done"], ["picking_type.code", "=", "incoming"]],
    )
    deliveries_count = await async_count(
        "stock.picking",
        domain=[["date_done", ">=", start_dt], ["date_done", "<=", end_dt],
                ["state", "=", "done"], ["picking_type.code", "=", "outgoing"]],
    )

    # --- Timeline: recent events, most recent first, across sources ---
    timeline: list[dict[str, Any]] = []

    sale_rows = await async_search_read(
        "sale.order",
        domain=[["date_order", ">=", start_dt], ["date_order", "<=", end_dt], ["state", "in", ["sale", "done"]]],
        fields=["id", "name", "date_order", "amount_total", "partner_id"],
        order="date_order desc", limit=30,
    )
    for r in sale_rows.get("records", []):
        timeline.append({
            "kind": "sale",
            "at": _iso(r.get("date_order")),
            "ref": r.get("name"),
            "amount": r.get("amount_total"),
            "partner": _m2o_name(r.get("partner_id")),
            "link": f"/admin/sales/orders/{r['id']}",
        })

    purchase_rows = await async_search_read(
        "purchase.order",
        domain=[["date_order", ">=", start_dt], ["date_order", "<=", end_dt], ["state", "in", ["purchase", "done"]]],
        fields=["id", "name", "date_order", "amount_total", "partner_id"],
        order="date_order desc", limit=30,
    )
    for r in purchase_rows.get("records", []):
        timeline.append({
            "kind": "purchase",
            "at": _iso(r.get("date_order")),
            "ref": r.get("name"),
            "amount": r.get("amount_total"),
            "partner": _m2o_name(r.get("partner_id")),
            "link": f"/admin/purchase/orders/{r['id']}",
        })

    invoice_rows = await async_search_read(
        "account.move",
        domain=[["date", ">=", start_s], ["date", "<=", end_s], ["state", "=", "posted"], ["move_type", "in", ["out_invoice", "in_invoice"]]],
        fields=["id", "name", "date", "amount_total", "partner_id", "move_type"],
        order="date desc, id desc", limit=30,
    )
    for r in invoice_rows.get("records", []):
        mt = r.get("move_type")
        timeline.append({
            "kind": "invoice" if mt == "out_invoice" else "bill",
            "at": _iso(r.get("date")),
            "ref": r.get("name"),
            "amount": r.get("amount_total"),
            "partner": _m2o_name(r.get("partner_id")),
            "link": f"/admin/invoicing/invoices/{r['id']}",
        })

    if bank_journal_ids:
        payment_rows = await async_search_read(
            "account.payment",
            domain=[["date", ">=", start_s], ["date", "<=", end_s], ["state", "=", "posted"],
                    ["journal_id", "in", bank_journal_ids]],
            fields=["id", "name", "date", "amount", "partner_id", "payment_type", "journal_id"],
            order="date desc, id desc", limit=30,
        )
        for r in payment_rows.get("records", []):
            pt = r.get("payment_type")
            timeline.append({
                "kind": "deposit" if pt == "inbound" else "withdrawal",
                "at": _iso(r.get("date")),
                "ref": r.get("name"),
                "amount": r.get("amount"),
                "partner": _m2o_name(r.get("partner_id")),
                "journal": _m2o_name(r.get("journal_id")),
                "link": None,
            })

    picking_rows = await async_search_read(
        "stock.picking",
        domain=[["date_done", ">=", start_dt], ["date_done", "<=", end_dt], ["state", "=", "done"]],
        fields=["id", "name", "date_done", "partner_id", "picking_type_id", "picking_type_code"],
        order="date_done desc", limit=30,
    )
    for r in picking_rows.get("records", []):
        code = r.get("picking_type_code")
        timeline.append({
            "kind": "receipt" if code == "incoming" else "delivery" if code == "outgoing" else "transfer",
            "at": _iso(r.get("date_done")),
            "ref": r.get("name"),
            "partner": _m2o_name(r.get("partner_id")),
            "link": f"/admin/inventory/transfers/{r['id']}",
        })

    # Sort timeline by at desc (None → end)
    timeline.sort(key=lambda x: (x.get("at") or ""), reverse=True)
    timeline = timeline[:80]

    return {
        "range": {"start": start_s, "end": end_s, "days": days},
        "summary": {
            "sales": {"total": round(sale_total, 2), "count": sale_count},
            "purchases": {"total": round(purchase_total, 2), "count": purchase_count},
            "invoices": {"total": round(invoice_total, 2), "count": invoice_count},
            "bills": {"total": round(bill_total, 2), "count": bill_count},
            "deposits": {"total": round(deposits_total, 2), "count": deposits_count},
            "withdrawals": {"total": round(withdrawals_total, 2), "count": withdrawals_count},
            "receipts": {"count": receipts_count},
            "deliveries": {"count": deliveries_count},
            "cash_net": round(deposits_total - withdrawals_total, 2),
        },
        "timeline": timeline,
    }


def _iso(v: Any) -> str | None:
    if v is None or v is False:
        return None
    if isinstance(v, (datetime, _date)):
        return v.isoformat()
    return str(v)


def _m2o_name(v: Any) -> str:
    if isinstance(v, list) and len(v) >= 2:
        return str(v[1])
    return ""
