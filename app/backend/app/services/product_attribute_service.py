"""Product attribute / variant management service.

Handles:
- Listing attributes & values for pickers
- CRUD on product.template.attribute.line (per-product selected attribute+values)
- Variant regeneration: compute cartesian product of selected values and sync
  product.product rows (wipe obsolete, create new, link via product_variant_combination).
"""
import logging
from itertools import product as _cartesian
from typing import Any, Optional

from sqlalchemy import select, delete, insert, text
from sqlalchemy.orm import selectinload

from app.services.base import get_session
from app.models.sale.product import ProductTemplate, ProductProduct
from app.models.sale.product_attribute import (
    ProductAttribute,
    ProductAttributeValue,
    ProductTemplateAttributeLine,
    ProductTemplateAttributeValue,
    product_attribute_value_ptal_rel,
    product_variant_combination,
)

_logger = logging.getLogger(__name__)


def _str(v: Any) -> str:
    """Extract a display string from a JSONB {"en_US": "..."} or plain value."""
    if isinstance(v, dict):
        return v.get("en_US") or next(iter(v.values()), "") or ""
    return str(v) if v is not None else ""


# --- Read helpers ---------------------------------------------------------

async def list_attributes() -> list[dict]:
    """Return all active attributes with their values (for the attribute picker)."""
    async with await get_session() as session:
        q = (
            select(ProductAttribute)
            .where(ProductAttribute.active.isnot(False))
            .order_by(ProductAttribute.sequence.asc().nulls_last(), ProductAttribute.id.asc())
            .options(selectinload(ProductAttribute.values))
        )
        attrs = (await session.execute(q)).scalars().all()
        return [
            {
                "id": a.id,
                "name": _str(a.name),
                "create_variant": a.create_variant or "always",
                "display_type": a.display_type or "radio",
                "values": [
                    {"id": v.id, "name": _str(v.name), "html_color": v.html_color, "sequence": v.sequence or 0}
                    for v in (a.values or [])
                    if v.active is not False
                ],
            }
            for a in attrs
        ]


async def get_template_attribute_lines(product_tmpl_id: int) -> list[dict]:
    """Return the attribute lines for a product template (attribute + selected values)."""
    async with await get_session() as session:
        q = (
            select(ProductTemplateAttributeLine)
            .where(
                ProductTemplateAttributeLine.product_tmpl_id == product_tmpl_id,
                ProductTemplateAttributeLine.active.isnot(False),
            )
            .order_by(ProductTemplateAttributeLine.sequence.asc().nulls_last(), ProductTemplateAttributeLine.id.asc())
            .options(
                selectinload(ProductTemplateAttributeLine.attribute),
                selectinload(ProductTemplateAttributeLine.value_ids),
            )
        )
        lines = (await session.execute(q)).scalars().all()
        return [
            {
                "id": line.id,
                "attribute_id": line.attribute_id,
                "attribute_name": _str(line.attribute.name) if line.attribute else "",
                "value_ids": [
                    {"id": v.id, "name": _str(v.name), "html_color": v.html_color}
                    for v in (line.value_ids or [])
                ],
                "sequence": line.sequence or 0,
            }
            for line in lines
        ]


# --- Mutations -----------------------------------------------------------

async def create_attribute_line(product_tmpl_id: int, attribute_id: int, value_ids: list[int]) -> int:
    """Create a new attribute line for a product template with the given values."""
    async with await get_session() as session:
        line = ProductTemplateAttributeLine(
            product_tmpl_id=product_tmpl_id,
            attribute_id=attribute_id,
            sequence=10,
            value_count=len(value_ids),
            active=True,
        )
        session.add(line)
        await session.flush()

        # Link values via M2M
        for vid in value_ids:
            await session.execute(
                insert(product_attribute_value_ptal_rel).values(
                    product_attribute_value_id=vid,
                    product_template_attribute_line_id=line.id,
                )
            )

        await session.commit()
        return line.id


async def update_attribute_line_values(line_id: int, value_ids: list[int]) -> None:
    """Replace the value selections on an existing attribute line."""
    async with await get_session() as session:
        # Wipe existing links
        await session.execute(
            delete(product_attribute_value_ptal_rel).where(
                product_attribute_value_ptal_rel.c.product_template_attribute_line_id == line_id
            )
        )
        # Insert new
        for vid in value_ids:
            await session.execute(
                insert(product_attribute_value_ptal_rel).values(
                    product_attribute_value_id=vid,
                    product_template_attribute_line_id=line_id,
                )
            )
        # Update value_count
        await session.execute(
            ProductTemplateAttributeLine.__table__.update()
            .where(ProductTemplateAttributeLine.id == line_id)
            .values(value_count=len(value_ids))
        )
        await session.commit()


async def delete_attribute_line(line_id: int) -> None:
    """Delete an attribute line (cascades to M2M + ptav + variant combinations)."""
    async with await get_session() as session:
        # Find ptav ids for this line so we can wipe variant combinations referencing them
        ptav_ids = (
            await session.execute(
                select(ProductTemplateAttributeValue.id).where(
                    ProductTemplateAttributeValue.attribute_line_id == line_id
                )
            )
        ).scalars().all()
        if ptav_ids:
            await session.execute(
                delete(product_variant_combination).where(
                    product_variant_combination.c.product_template_attribute_value_id.in_(ptav_ids)
                )
            )
            await session.execute(
                delete(ProductTemplateAttributeValue).where(
                    ProductTemplateAttributeValue.id.in_(ptav_ids)
                )
            )
        await session.execute(
            delete(product_attribute_value_ptal_rel).where(
                product_attribute_value_ptal_rel.c.product_template_attribute_line_id == line_id
            )
        )
        await session.execute(
            delete(ProductTemplateAttributeLine).where(
                ProductTemplateAttributeLine.id == line_id
            )
        )
        await session.commit()


async def create_attribute_value(attribute_id: int, name: str, html_color: Optional[str] = None) -> dict:
    """Create a new value under an attribute (inline-create from the UI)."""
    async with await get_session() as session:
        value = ProductAttributeValue(
            attribute_id=attribute_id,
            name={"en_US": name},
            sequence=10,
            html_color=html_color,
            active=True,
        )
        session.add(value)
        await session.flush()
        await session.commit()
        return {"id": value.id, "name": name, "html_color": html_color}


async def create_attribute(name: str, create_variant: str = "always", display_type: str = "radio") -> dict:
    """Create a new attribute (inline-create from the UI)."""
    async with await get_session() as session:
        attr = ProductAttribute(
            name={"en_US": name},
            sequence=10,
            create_variant=create_variant,
            display_type=display_type,
            active=True,
        )
        session.add(attr)
        await session.flush()
        await session.commit()
        return {"id": attr.id, "name": name, "create_variant": create_variant, "display_type": display_type, "values": []}


# --- Variant regeneration ------------------------------------------------

async def regenerate_variants(product_tmpl_id: int) -> dict:
    """Rebuild product.product variants for a template based on current attribute lines.

    Logic:
      1. For each active attribute line, ensure a product_template_attribute_value row exists
         for every (line, selected_value). Drop obsolete ones.
      2. Compute the cartesian product of ptav groups (one group per line).
      3. Wipe all existing variants for this template and their combination rows.
      4. Create one product.product per combination; link via product_variant_combination.
      5. If no attribute lines exist, keep exactly one variant with no combination.
    """
    async with await get_session() as session:
        # Load template + lines + values
        lines = (
            await session.execute(
                select(ProductTemplateAttributeLine)
                .where(
                    ProductTemplateAttributeLine.product_tmpl_id == product_tmpl_id,
                    ProductTemplateAttributeLine.active.isnot(False),
                )
                .options(selectinload(ProductTemplateAttributeLine.value_ids))
            )
        ).scalars().all()

        # --- Step 1: ensure ptav rows match selected values ---
        # existing ptavs for this template
        existing_ptavs = (
            await session.execute(
                select(ProductTemplateAttributeValue).where(
                    ProductTemplateAttributeValue.product_tmpl_id == product_tmpl_id
                )
            )
        ).scalars().all()
        ptav_by_key = {(p.attribute_line_id, p.product_attribute_value_id): p for p in existing_ptavs}

        # Desired (line_id, value_id) set
        desired: set[tuple[int, int]] = set()
        for line in lines:
            for val in (line.value_ids or []):
                desired.add((line.id, val.id))

        # Delete ptavs no longer desired (and their variant combinations)
        obsolete_ids = [p.id for key, p in ptav_by_key.items() if key not in desired]
        if obsolete_ids:
            await session.execute(
                delete(product_variant_combination).where(
                    product_variant_combination.c.product_template_attribute_value_id.in_(obsolete_ids)
                )
            )
            await session.execute(
                delete(ProductTemplateAttributeValue).where(
                    ProductTemplateAttributeValue.id.in_(obsolete_ids)
                )
            )

        # Create missing ptavs
        ptav_cache: dict[tuple[int, int], int] = {}
        for line in lines:
            for val in (line.value_ids or []):
                key = (line.id, val.id)
                existing = ptav_by_key.get(key)
                if existing is None or existing.id in obsolete_ids:
                    new_ptav = ProductTemplateAttributeValue(
                        product_tmpl_id=product_tmpl_id,
                        attribute_line_id=line.id,
                        attribute_id=line.attribute_id,
                        product_attribute_value_id=val.id,
                        price_extra=0,
                        ptav_active=True,
                    )
                    session.add(new_ptav)
                    await session.flush()
                    ptav_cache[key] = new_ptav.id
                else:
                    ptav_cache[key] = existing.id

        await session.flush()

        # --- Step 2: compute combinations ---
        if lines:
            groups: list[list[int]] = []
            for line in lines:
                group = [ptav_cache[(line.id, v.id)] for v in (line.value_ids or []) if (line.id, v.id) in ptav_cache]
                if group:
                    groups.append(group)
            combinations = [list(c) for c in _cartesian(*groups)] if groups else []
        else:
            combinations = []

        # --- Step 3: wipe existing variants & combinations for this template ---
        existing_variant_ids = (
            await session.execute(
                select(ProductProduct.id).where(ProductProduct.product_tmpl_id == product_tmpl_id)
            )
        ).scalars().all()
        if existing_variant_ids:
            await session.execute(
                delete(product_variant_combination).where(
                    product_variant_combination.c.product_product_id.in_(existing_variant_ids)
                )
            )
            await session.execute(
                delete(ProductProduct).where(ProductProduct.id.in_(existing_variant_ids))
            )

        # --- Step 4/5: create variants ---
        created_count = 0
        if combinations:
            for combo in combinations:
                variant = ProductProduct(product_tmpl_id=product_tmpl_id, active=True)
                session.add(variant)
                await session.flush()
                for ptav_id in combo:
                    await session.execute(
                        insert(product_variant_combination).values(
                            product_product_id=variant.id,
                            product_template_attribute_value_id=ptav_id,
                        )
                    )
                created_count += 1
        else:
            # No attributes → one default variant
            variant = ProductProduct(product_tmpl_id=product_tmpl_id, active=True)
            session.add(variant)
            await session.flush()
            created_count = 1

        await session.commit()
        return {"variants_created": created_count, "combinations": len(combinations)}


async def list_variants(product_tmpl_id: int) -> list[dict]:
    """List all variants of a template with their value names (for display)."""
    async with await get_session() as session:
        variants = (
            await session.execute(
                select(ProductProduct)
                .where(ProductProduct.product_tmpl_id == product_tmpl_id)
                .order_by(ProductProduct.id.asc())
            )
        ).scalars().all()

        # For each variant, fetch its ptav -> value name list
        result = []
        for v in variants:
            rows = (
                await session.execute(
                    select(ProductTemplateAttributeValue, ProductAttribute.name, ProductAttributeValue.name)
                    .join(
                        product_variant_combination,
                        product_variant_combination.c.product_template_attribute_value_id
                        == ProductTemplateAttributeValue.id,
                    )
                    .join(
                        ProductAttribute,
                        ProductAttribute.id == ProductTemplateAttributeValue.attribute_id,
                    )
                    .join(
                        ProductAttributeValue,
                        ProductAttributeValue.id == ProductTemplateAttributeValue.product_attribute_value_id,
                    )
                    .where(product_variant_combination.c.product_product_id == v.id)
                )
            ).all()
            combo_label = ", ".join(f"{_str(attr_name)}: {_str(val_name)}" for _ptav, attr_name, val_name in rows)
            price_extra_total = sum(float(ptav.price_extra or 0) for ptav, _a, _val in rows)
            # Return the list of ptav ids so the UI can update them individually
            ptav_entries = [
                {"ptav_id": ptav.id, "attribute": _str(attr_name), "value": _str(val_name),
                 "price_extra": float(ptav.price_extra or 0)}
                for ptav, attr_name, val_name in rows
            ]
            result.append({
                "id": v.id,
                "default_code": v.default_code,
                "barcode": v.barcode,
                "active": v.active,
                "combo_label": combo_label,
                "price_extra": price_extra_total,
                "ptav_entries": ptav_entries,
            })
        return result


async def update_ptav_price_extra(ptav_id: int, price_extra: float) -> None:
    """Update the extra price for a single product.template.attribute.value."""
    async with await get_session() as session:
        from sqlalchemy import update as sql_update
        await session.execute(
            sql_update(ProductTemplateAttributeValue)
            .where(ProductTemplateAttributeValue.id == ptav_id)
            .values(price_extra=price_extra)
        )
        await session.commit()
