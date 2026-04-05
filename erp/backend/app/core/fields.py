"""
Field metadata service.

Provides enriched field information for dynamic form/list rendering,
including field types, relations, selection options, and computed field info.
"""
import logging
from typing import Any

from app.core.orm_adapter import mashora_env

_logger = logging.getLogger(__name__)


def get_fields_info(
    model: str,
    fields: Optional[list[str]] = None,
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict:
    """
    Get detailed field metadata for a model.

    Returns enriched field information suitable for building dynamic forms.
    """
    with mashora_env(uid=uid, context=context) as env:
        Model = env[model]
        attributes = [
            "string", "type", "required", "readonly", "help",
            "selection", "relation", "relation_field",
            "store", "sortable", "searchable", "groupable",
            "depends", "compute", "inverse", "default",
            "domain", "context", "groups",
            "size", "translate",
        ]
        fields_data = Model.fields_get(allfields=fields, attributes=attributes)

        # Enrich with additional metadata
        enriched = {}
        for fname, fdata in fields_data.items():
            field_info = {
                "name": fname,
                "label": fdata.get("string", fname),
                "type": fdata.get("type", "char"),
                "required": fdata.get("required", False),
                "readonly": fdata.get("readonly", False),
                "help": fdata.get("help", ""),
                "sortable": fdata.get("sortable", False),
                "searchable": fdata.get("searchable", False),
                "groupable": fdata.get("groupable", False),
                "store": fdata.get("store", True),
                "translate": fdata.get("translate", False),
            }

            # Selection options
            if fdata.get("selection"):
                field_info["selection"] = fdata["selection"]

            # Relational info
            if fdata.get("relation"):
                field_info["relation"] = fdata["relation"]
                field_info["relation_field"] = fdata.get("relation_field", "")
                if fdata.get("domain"):
                    field_info["domain"] = fdata["domain"]

            # Computed
            if fdata.get("compute"):
                field_info["computed"] = True
                field_info["depends"] = fdata.get("depends", [])

            enriched[fname] = field_info

        return {
            "model": model,
            "fields": enriched,
            "field_count": len(enriched),
        }


def get_model_info(model: str, uid: int = 1, context: Optional[dict] = None) -> dict:
    """Get model-level metadata (name, description, access rights, etc.)."""
    with mashora_env(uid=uid, context=context) as env:
        Model = env[model]
        ir_model = env["ir.model"].search([("model", "=", model)], limit=1)

        model_info = {
            "model": model,
            "name": ir_model.name if ir_model else model,
            "description": Model._description or "",
            "table": Model._table,
            "order": Model._order or "id",
            "rec_name": Model._rec_name or "name",
            "parent_name": getattr(Model, "_parent_name", None),
            "is_transient": Model._transient,
        }

        # Check access rights
        for op in ["read", "write", "create", "unlink"]:
            try:
                Model.check_access_rights(op, raise_exception=True)
                model_info[f"can_{op}"] = True
            except Exception:
                model_info[f"can_{op}"] = False

        return model_info


def get_selection_values(model: str, field: str, uid: int = 1, context: Optional[dict] = None) -> dict:
    """Get selection field values for a specific field."""
    with mashora_env(uid=uid, context=context) as env:
        Model = env[model]
        fields_data = Model.fields_get([field], attributes=["selection", "string"])
        fdata = fields_data.get(field, {})
        return {
            "model": model,
            "field": field,
            "label": fdata.get("string", field),
            "selection": fdata.get("selection", []),
        }


def search_relation(
    model: str,
    field: str,
    search: str = "",
    limit: int = 20,
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict:
    """
    Search for records in a related model (for Many2one dropdowns).

    This powers the autocomplete/search in Many2one field components.
    """
    with mashora_env(uid=uid, context=context) as env:
        Model = env[model]
        fields_data = Model.fields_get([field], attributes=["relation", "domain"])
        fdata = fields_data.get(field, {})
        relation = fdata.get("relation")

        if not relation:
            return {"error": f"Field '{field}' on '{model}' is not a relational field"}

        RelModel = env[relation]
        domain: list[Any] = []

        # Apply field domain if defined
        if fdata.get("domain"):
            try:
                import ast
                field_domain = ast.literal_eval(str(fdata["domain"]))
                if isinstance(field_domain, list):
                    domain.extend(field_domain)
            except Exception:
                pass

        # Add search filter
        rec_name = RelModel._rec_name or "name"
        if search:
            domain.append([(rec_name, "ilike", search)])

        records = RelModel.search(domain, limit=limit)
        data = records.read(["id", rec_name])

        return {
            "model": relation,
            "field": field,
            "results": [{"id": r["id"], "name": r.get(rec_name, "")} for r in data],
            "total": len(data),
        }
