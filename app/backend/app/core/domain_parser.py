"""
Mashora domain expression parser.

Translates Mashora domain filters like:
    [["state", "=", "draft"], ["partner_id", "!=", False]]

Into SQLAlchemy WHERE clauses:
    and_(Model.state == "draft", Model.partner_id.isnot(None))

Supports:
    - Comparison operators: =, !=, <, >, <=, >=
    - String operators: like, ilike, not like, not ilike, =like, =ilike
    - Collection operators: in, not in
    - Boolean operators: |, &, ! (Polish notation)
    - Dotted field paths: "partner_id.name" → joined lookup
"""
from typing import Any

from sqlalchemy import and_, not_, or_
from sqlalchemy.orm import InspectionAttr, RelationshipProperty
from sqlalchemy.sql import ColumnElement


def _get_column(model_cls, field_name: str):
    """Get a SQLAlchemy column from a model class, handling dotted paths."""
    if "." in field_name:
        parts = field_name.split(".")
        return getattr(model_cls, parts[0], None)
    return getattr(model_cls, field_name, None)


def _is_relationship(model_cls, attr_name: str) -> bool:
    """Return True if the attribute is a SQLAlchemy relationship (not a scalar column)."""
    attr = getattr(model_cls, attr_name, None)
    if attr is None:
        return False
    prop = getattr(attr, "property", None)
    return isinstance(prop, RelationshipProperty)


def _coerce_value(col, value: Any) -> Any:
    """Coerce string values to proper Python types based on column type."""
    if value is None or value is False:
        return value
    if not isinstance(value, str):
        return value

    # Get the SQLAlchemy column type
    try:
        from sqlalchemy import Date, DateTime
        col_obj = col.property.columns[0] if hasattr(col, 'property') else col
        col_type = type(col_obj.type)

        if col_type in (Date,) or col_type.__name__ == 'Date':
            from datetime import date as dt_date
            return dt_date.fromisoformat(value)
        elif col_type in (DateTime,) or col_type.__name__ in ('DateTime', 'TIMESTAMP'):
            from datetime import datetime as dt_datetime
            if 'T' in value:
                return dt_datetime.fromisoformat(value)
            else:
                return dt_datetime.fromisoformat(value + 'T00:00:00')
    except Exception:
        pass

    return value


def _make_condition(model_cls, field_name: str, operator: str, value: Any) -> ColumnElement:
    """Convert a single (field, operator, value) triple to a SQLAlchemy condition."""

    # Handle one-hop dotted paths on relationships: "order_line.product_id", "partner_id.name"
    if "." in field_name:
        head, *rest = field_name.split(".", 1)
        tail = rest[0] if rest else ""
        rel_attr = getattr(model_cls, head, None)
        if rel_attr is not None and _is_relationship(model_cls, head):
            target_cls = rel_attr.property.mapper.class_
            # Recurse so the tail can itself be dotted (but we only support one extra hop here)
            inner = _make_condition(target_cls, tail, operator, value)
            if rel_attr.property.uselist:
                # one-to-many / many-to-many → EXISTS subquery
                return rel_attr.any(inner)
            else:
                # many-to-one → HAS subquery
                return rel_attr.has(inner)

    col = _get_column(model_cls, field_name)
    if col is None:
        # Unknown field — return always-true to avoid breaking queries
        return and_()

    # Coerce string dates to proper types
    value = _coerce_value(col, value)

    op = operator.lower().strip()

    if op == "=":
        if value is False or value is None:
            return col.is_(None)
        return col == value
    elif op == "!=":
        if value is False or value is None:
            return col.isnot(None)
        return col != value
    elif op == "<":
        return col < value
    elif op == ">":
        return col > value
    elif op == "<=":
        return col <= value
    elif op == ">=":
        return col >= value
    elif op == "in":
        if not value:
            # Empty IN → always false
            return and_(col.is_(None), col.isnot(None))
        return col.in_(value)
    elif op == "not in":
        if not value:
            return and_()  # always true
        return col.notin_(value)
    elif op == "like":
        return col.like(value)
    elif op == "not like":
        return col.notlike(value)
    elif op == "ilike":
        return col.ilike(f"%{value}%") if "%" not in str(value) else col.ilike(value)
    elif op == "not ilike":
        v = f"%{value}%" if "%" not in str(value) else value
        return col.notilike(v)
    elif op == "=like":
        return col.like(value)
    elif op == "=ilike":
        return col.ilike(value)
    elif op == "child_of":
        # Simplified: treat as equals for now
        return col == value
    elif op == "parent_of":
        return col == value
    else:
        # Unknown operator — default to equals
        return col == value


def parse_domain(model_cls, domain: list) -> ColumnElement:
    """
    Parse a Mashora domain list into a SQLAlchemy WHERE clause.

    Mashora domains use Polish (prefix) notation for boolean operators:
        ["|", ("a", "=", 1), ("b", "=", 2)]  →  a=1 OR b=2
        ["&", ("a", "=", 1), ("b", "=", 2)]  →  a=1 AND b=2
        ["!", ("a", "=", 1)]                  →  NOT a=1

    Default combining operator is AND.
    """
    if not domain:
        return and_()

    # Convert domain items to a flat list
    stack: list[ColumnElement] = []
    operators: list[str] = []

    # Process in reverse for Polish notation
    i = len(domain) - 1
    while i >= 0:
        item = domain[i]

        if isinstance(item, (list, tuple)) and len(item) == 3:
            # It's a leaf: (field, operator, value)
            field, op, val = item
            condition = _make_condition(model_cls, str(field), str(op), val)
            stack.append(condition)
        elif isinstance(item, str) and item in ("|", "&"):
            # Binary operator — pop two from stack and combine
            if len(stack) >= 2:
                right = stack.pop()
                left = stack.pop()
                if item == "|":
                    stack.append(or_(left, right))
                else:
                    stack.append(and_(left, right))
            elif len(stack) == 1:
                pass  # just leave it
        elif isinstance(item, str) and item == "!":
            if stack:
                top = stack.pop()
                stack.append(not_(top))
        i -= 1

    if not stack:
        return and_()

    # Combine remaining with AND
    if len(stack) == 1:
        return stack[0]
    return and_(*stack)
