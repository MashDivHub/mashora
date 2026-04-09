"""
Field metadata service.

Provides enriched field information for dynamic form/list rendering.
Now uses SQLAlchemy model introspection instead of Mashora ORM.
"""
import logging
from typing import Any, Optional

from app.core.model_registry import get_model_class, get_fields_info as _registry_fields_info
from app.services.base import async_search_read

_logger = logging.getLogger(__name__)


async def get_fields_info(
    model: str,
    fields: Optional[list[str]] = None,
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict:
    """Get detailed field metadata for a model."""
    all_fields = _registry_fields_info(model)

    if fields:
        all_fields = {k: v for k, v in all_fields.items() if k in fields}

    # Enrich with labels
    enriched = {}
    for fname, fdata in all_fields.items():
        field_info = {
            "name": fname,
            "label": fdata.get("string", fname.replace("_", " ").title()),
            "type": fdata.get("type", "char"),
            "required": fdata.get("required", False),
            "readonly": fdata.get("readonly", False),
            "help": "",
            "sortable": fdata.get("store", True),
            "searchable": fdata.get("store", True),
            "groupable": fdata.get("store", True),
            "store": fdata.get("store", True),
            "translate": False,
        }
        if fdata.get("type") == "many2one" and fdata.get("relation"):
            field_info["relation"] = fdata["relation"]
        enriched[fname] = field_info

    return {
        "model": model,
        "fields": enriched,
        "field_count": len(enriched),
    }


async def get_model_info(model: str, uid: int = 1, context: Optional[dict] = None) -> dict:
    """Get model-level metadata."""
    model_cls = get_model_class(model)
    if model_cls is None:
        return {"model": model, "error": "Model not found"}

    # Look up ir.model record
    ir_result = await async_search_read(
        "ir.model",
        domain=[["model", "=", model]],
        fields=["id", "name", "model"],
        limit=1,
    )
    ir_name = ir_result["records"][0]["name"] if ir_result["records"] else model

    return {
        "model": model,
        "name": ir_name,
        "description": "",
        "table": getattr(model_cls, "__tablename__", ""),
        "order": "id",
        "rec_name": "name" if hasattr(model_cls, "name") else "id",
        "is_transient": False,
        "can_read": True,
        "can_write": True,
        "can_create": True,
        "can_unlink": True,
    }


async def get_selection_values(model: str, field: str, uid: int = 1, context: Optional[dict] = None) -> dict:
    """Get selection field values for a specific field."""
    fields_data = _registry_fields_info(model)
    fdata = fields_data.get(field, {})
    return {
        "model": model,
        "field": field,
        "label": fdata.get("string", field),
        "selection": fdata.get("selection", []),
    }


async def search_relation(
    model: str,
    field: str,
    search: str = "",
    limit: int = 20,
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict:
    """Search for records in a related model (for Many2one dropdowns)."""
    fields_data = _registry_fields_info(model)
    fdata = fields_data.get(field, {})
    relation = fdata.get("relation")

    if not relation:
        return {"error": f"Field '{field}' on '{model}' is not a relational field"}

    domain = []
    if search:
        domain.append(["name", "ilike", search])

    result = await async_search_read(
        relation,
        domain=domain,
        fields=["id", "name"],
        limit=limit,
    )

    return {
        "model": relation,
        "field": field,
        "results": [{"id": r["id"], "name": r.get("name", "")} for r in result["records"]],
        "total": result["total"],
    }
