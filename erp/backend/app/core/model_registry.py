"""
Model registry mapping Mashora model names to SQLAlchemy model classes.

Maps dot-notation names like 'res.partner' to the corresponding
SQLAlchemy model class. Also provides field metadata introspection
from SQLAlchemy column definitions.
"""
import logging
from typing import Any, Optional, Type

from sqlalchemy import inspect as sa_inspect
from sqlalchemy.orm import Mapped

from app.db.base import Base

_logger = logging.getLogger(__name__)

# Model name → SQLAlchemy class mapping
_registry: dict[str, Type[Base]] = {}


def _table_to_model_name(tablename: str) -> str:
    """Convert table name to Mashora model name: 'res_partner' → 'res.partner'."""
    return tablename.replace("_", ".")


def _build_registry() -> None:
    """Scan all Base subclasses and register them."""
    global _registry
    _registry.clear()

    for mapper in Base.registry.mappers:
        cls = mapper.class_
        tablename = getattr(cls, "__tablename__", None)
        if tablename:
            # Register by table-derived name
            model_name = _table_to_model_name(tablename)
            _registry[model_name] = cls

            # Also register by explicit mashora_name if set
            mashora_name = getattr(cls, "__mashora_name__", None)
            if mashora_name:
                _registry[mashora_name] = cls

    _logger.info("Model registry built: %d models registered", len(_registry))


def get_model_class(model_name: str) -> Optional[Type[Base]]:
    """
    Get SQLAlchemy model class by Mashora model name.

    Args:
        model_name: Dot-notation name like 'res.partner' or 'sale.order'

    Returns:
        The SQLAlchemy model class, or None if not found.
    """
    if not _registry:
        _build_registry()

    cls = _registry.get(model_name)
    if cls is None:
        # Try with underscores
        underscore_name = model_name.replace(".", "_")
        for key, val in _registry.items():
            if getattr(val, "__tablename__", "") == underscore_name:
                cls = val
                _registry[model_name] = val  # cache for next time
                break

    return cls


def list_models() -> list[str]:
    """List all registered model names."""
    if not _registry:
        _build_registry()
    return sorted(_registry.keys())


def get_fields_info(model_name: str, attributes: Optional[list[str]] = None) -> dict[str, Any]:
    """
    Get field metadata for a model, similar to Mashora's fields_get().

    Returns dict of field_name → {type, string, required, readonly, ...}
    """
    cls = get_model_class(model_name)
    if cls is None:
        return {}

    mapper = sa_inspect(cls)
    result = {}

    for col_attr in mapper.column_attrs:
        col_name = col_attr.key
        columns = col_attr.columns
        if not columns:
            continue
        col = columns[0]

        field_info: dict[str, Any] = {
            "name": col_name,
            "type": _sa_type_to_mashora_type(col.type),
            "string": col_name.replace("_", " ").title(),
            "required": not col.nullable,
            "readonly": False,
            "store": True,
        }

        # Add relation info for foreign keys
        if col.foreign_keys:
            fk = next(iter(col.foreign_keys))
            target_table = fk.column.table.name
            field_info["type"] = "many2one"
            field_info["relation"] = _table_to_model_name(target_table)

        if attributes:
            field_info = {k: v for k, v in field_info.items() if k in attributes or k == "name"}

        result[col_name] = field_info

    # Add relationship fields
    for rel in mapper.relationships:
        rel_info: dict[str, Any] = {
            "name": rel.key,
            "string": rel.key.replace("_", " ").title(),
            "readonly": False,
            "store": True,
        }
        if rel.uselist:
            rel_info["type"] = "one2many"
        else:
            rel_info["type"] = "many2one"

        target_cls = rel.mapper.class_
        target_table = getattr(target_cls, "__tablename__", "")
        rel_info["relation"] = _table_to_model_name(target_table)

        if attributes:
            rel_info = {k: v for k, v in rel_info.items() if k in attributes or k == "name"}

        result[rel.key] = rel_info

    return result


def _sa_type_to_mashora_type(sa_type) -> str:
    """Map SQLAlchemy column type to Mashora field type string."""
    type_name = type(sa_type).__name__.lower()

    mapping = {
        "integer": "integer",
        "biginteger": "integer",
        "smallinteger": "integer",
        "float": "float",
        "numeric": "float",
        "double": "float",
        "string": "char",
        "varchar": "char",
        "text": "text",
        "boolean": "boolean",
        "date": "date",
        "datetime": "datetime",
        "timestamp": "datetime",
        "json": "json",
        "jsonb": "char",  # Mashora stores translated text as JSONB
        "largebinary": "binary",
        "binary": "binary",
    }

    return mapping.get(type_name, "char")


def rebuild_registry() -> None:
    """Force rebuild the model registry (e.g., after new models are loaded)."""
    _build_registry()
