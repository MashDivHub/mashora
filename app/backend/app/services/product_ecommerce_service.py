"""Product e-commerce fields service (tags, optional products, accessory,
alternative, public categories, out-of-stock behavior, media gallery)."""
from typing import Any, Optional

from sqlalchemy import select, delete, insert, update

from app.services.base import get_session
from app.models.sale.product import ProductTemplate
from app.models.sale.product_tag import (
    ProductTag,
    product_tag_template_rel,
    product_optional_rel,
)
from app.models.sale.product_public_category import (
    ProductPublicCategory,
    product_template_public_category_rel,
    product_accessory_rel,
    product_alternative_rel,
)
from app.models.sale.product_ecommerce_image import ProductEcommerceImage


def _str(v: Any) -> str:
    if isinstance(v, dict):
        return v.get("en_US") or next(iter(v.values()), "") or ""
    return str(v) if v is not None else ""


# --- Tags ----------------------------------------------------------------

async def list_tags() -> list[dict]:
    async with await get_session() as session:
        q = select(ProductTag).order_by(ProductTag.sequence.asc().nulls_last(), ProductTag.id.asc())
        tags = (await session.execute(q)).scalars().all()
        return [
            {
                "id": t.id,
                "name": _str(t.name),
                "color": t.color,
                "visible_to_customers": t.visible_to_customers,
            }
            for t in tags
        ]


async def create_tag(name: str, color: Optional[str] = None) -> dict:
    async with await get_session() as session:
        tag = ProductTag(name={"en_US": name}, color=color, visible_to_customers=True, sequence=10)
        session.add(tag)
        await session.flush()
        await session.commit()
        return {"id": tag.id, "name": name, "color": color, "visible_to_customers": True}


async def get_product_tags(product_tmpl_id: int) -> list[dict]:
    async with await get_session() as session:
        q = (
            select(ProductTag)
            .join(
                product_tag_template_rel,
                product_tag_template_rel.c.product_tag_id == ProductTag.id,
            )
            .where(product_tag_template_rel.c.product_template_id == product_tmpl_id)
        )
        tags = (await session.execute(q)).scalars().all()
        return [{"id": t.id, "name": _str(t.name), "color": t.color} for t in tags]


async def set_product_tags(product_tmpl_id: int, tag_ids: list[int]) -> None:
    async with await get_session() as session:
        await session.execute(
            delete(product_tag_template_rel).where(
                product_tag_template_rel.c.product_template_id == product_tmpl_id
            )
        )
        for tid in set(tag_ids):
            await session.execute(
                insert(product_tag_template_rel).values(
                    product_template_id=product_tmpl_id, product_tag_id=tid
                )
            )
        await session.commit()


# --- Optional products (upsell) ------------------------------------------

async def get_optional_products(product_tmpl_id: int) -> list[dict]:
    async with await get_session() as session:
        q = (
            select(ProductTemplate)
            .join(
                product_optional_rel,
                product_optional_rel.c.dest_id == ProductTemplate.id,
            )
            .where(product_optional_rel.c.src_id == product_tmpl_id)
        )
        rows = (await session.execute(q)).scalars().all()
        return [{"id": t.id, "name": _str(t.name), "list_price": float(t.list_price or 0)} for t in rows]


async def set_optional_products(product_tmpl_id: int, linked_ids: list[int]) -> None:
    async with await get_session() as session:
        await session.execute(
            delete(product_optional_rel).where(
                product_optional_rel.c.src_id == product_tmpl_id
            )
        )
        for dest in set(linked_ids):
            if dest == product_tmpl_id:
                continue  # don't link to self
            await session.execute(
                insert(product_optional_rel).values(src_id=product_tmpl_id, dest_id=dest)
            )
        await session.commit()


# --- Generic linked-products helper (accessory + alternative) -----------

async def _get_linked_products(product_tmpl_id: int, rel_table) -> list[dict]:
    async with await get_session() as session:
        q = (
            select(ProductTemplate)
            .join(rel_table, rel_table.c.dest_id == ProductTemplate.id)
            .where(rel_table.c.src_id == product_tmpl_id)
        )
        rows = (await session.execute(q)).scalars().all()
        return [{"id": t.id, "name": _str(t.name), "list_price": float(t.list_price or 0)} for t in rows]


async def _set_linked_products(product_tmpl_id: int, linked_ids: list[int], rel_table) -> None:
    async with await get_session() as session:
        await session.execute(
            delete(rel_table).where(rel_table.c.src_id == product_tmpl_id)
        )
        for dest in set(linked_ids):
            if dest == product_tmpl_id:
                continue
            await session.execute(
                insert(rel_table).values(src_id=product_tmpl_id, dest_id=dest)
            )
        await session.commit()


# --- Accessory products (cross-sell) ------------------------------------

async def get_accessory_products(product_tmpl_id: int) -> list[dict]:
    return await _get_linked_products(product_tmpl_id, product_accessory_rel)


async def set_accessory_products(product_tmpl_id: int, linked_ids: list[int]) -> None:
    await _set_linked_products(product_tmpl_id, linked_ids, product_accessory_rel)


# --- Alternative products ----------------------------------------------

async def get_alternative_products(product_tmpl_id: int) -> list[dict]:
    return await _get_linked_products(product_tmpl_id, product_alternative_rel)


async def set_alternative_products(product_tmpl_id: int, linked_ids: list[int]) -> None:
    await _set_linked_products(product_tmpl_id, linked_ids, product_alternative_rel)


# --- Public (storefront) categories -------------------------------------

async def list_public_categories() -> list[dict]:
    async with await get_session() as session:
        q = (
            select(ProductPublicCategory)
            .where(ProductPublicCategory.active.isnot(False))
            .order_by(ProductPublicCategory.sequence.asc().nulls_last(), ProductPublicCategory.id.asc())
        )
        rows = (await session.execute(q)).scalars().all()
        # Build display name with parent prefix when possible
        id_to_name = {c.id: _str(c.name) for c in rows}
        result = []
        for c in rows:
            label = _str(c.name)
            if c.parent_id and c.parent_id in id_to_name:
                label = f"{id_to_name[c.parent_id]} / {label}"
            result.append({
                "id": c.id,
                "name": _str(c.name),
                "parent_id": c.parent_id,
                "display_name": label,
            })
        return result


async def create_public_category(name: str, parent_id: Optional[int] = None) -> dict:
    async with await get_session() as session:
        cat = ProductPublicCategory(
            name={"en_US": name}, parent_id=parent_id, sequence=10, active=True,
        )
        session.add(cat)
        await session.flush()
        await session.commit()
        return {"id": cat.id, "name": name, "parent_id": parent_id, "display_name": name}


async def get_product_public_categories(product_tmpl_id: int) -> list[dict]:
    async with await get_session() as session:
        q = (
            select(ProductPublicCategory)
            .join(
                product_template_public_category_rel,
                product_template_public_category_rel.c.product_public_category_id == ProductPublicCategory.id,
            )
            .where(product_template_public_category_rel.c.product_template_id == product_tmpl_id)
        )
        rows = (await session.execute(q)).scalars().all()
        return [{"id": c.id, "name": _str(c.name), "parent_id": c.parent_id} for c in rows]


async def set_product_public_categories(product_tmpl_id: int, category_ids: list[int]) -> None:
    async with await get_session() as session:
        await session.execute(
            delete(product_template_public_category_rel).where(
                product_template_public_category_rel.c.product_template_id == product_tmpl_id
            )
        )
        for cid in set(category_ids):
            await session.execute(
                insert(product_template_public_category_rel).values(
                    product_template_id=product_tmpl_id,
                    product_public_category_id=cid,
                )
            )
        await session.commit()


# --- Out-of-stock behavior ---------------------------------------------

async def get_stock_settings(product_tmpl_id: int) -> dict:
    async with await get_session() as session:
        row = (
            await session.execute(
                select(
                    ProductTemplate.allow_out_of_stock_order,
                    ProductTemplate.out_of_stock_message,
                    ProductTemplate.available_threshold,
                    ProductTemplate.show_availability,
                ).where(ProductTemplate.id == product_tmpl_id)
            )
        ).first()
        if not row:
            return {}
        allow, msg, threshold, show = row
        return {
            "allow_out_of_stock_order": bool(allow) if allow is not None else True,
            "out_of_stock_message": msg or "",
            "available_threshold": float(threshold) if threshold is not None else None,
            "show_availability": bool(show) if show is not None else False,
        }


async def set_stock_settings(product_tmpl_id: int, payload: dict) -> None:
    vals: dict = {}
    if "allow_out_of_stock_order" in payload:
        vals["allow_out_of_stock_order"] = bool(payload["allow_out_of_stock_order"])
    if "out_of_stock_message" in payload:
        vals["out_of_stock_message"] = payload["out_of_stock_message"] or None
    if "available_threshold" in payload:
        v = payload["available_threshold"]
        vals["available_threshold"] = float(v) if v not in (None, "") else None
    if "show_availability" in payload:
        vals["show_availability"] = bool(payload["show_availability"])
    if not vals:
        return
    async with await get_session() as session:
        await session.execute(
            update(ProductTemplate).where(ProductTemplate.id == product_tmpl_id).values(**vals)
        )
        await session.commit()


# --- eCommerce media gallery -------------------------------------------

async def list_ecommerce_media(product_tmpl_id: int) -> list[dict]:
    async with await get_session() as session:
        q = (
            select(ProductEcommerceImage)
            .where(ProductEcommerceImage.product_tmpl_id == product_tmpl_id)
            .order_by(ProductEcommerceImage.sequence.asc().nulls_last(), ProductEcommerceImage.id.asc())
        )
        rows = (await session.execute(q)).scalars().all()
        return [
            {
                "id": m.id,
                "sequence": m.sequence or 10,
                "name": _str(m.name) if m.name else "",
                "video_url": m.video_url,
                "has_image": m.image_1920 is not None,
            }
            for m in rows
        ]


async def add_ecommerce_media(
    product_tmpl_id: int,
    name: Optional[str] = None,
    image_b64: Optional[str] = None,
    video_url: Optional[str] = None,
) -> dict:
    import base64
    image_bytes = None
    if image_b64:
        try:
            image_bytes = base64.b64decode(image_b64)
        except Exception:
            image_bytes = None
    async with await get_session() as session:
        media = ProductEcommerceImage(
            product_tmpl_id=product_tmpl_id,
            name={"en_US": name} if name else None,
            image_1920=image_bytes,
            video_url=video_url,
            sequence=10,
        )
        session.add(media)
        await session.flush()
        await session.commit()
        return {"id": media.id, "name": name or "", "video_url": video_url, "has_image": image_bytes is not None}


async def delete_ecommerce_media(media_id: int) -> None:
    async with await get_session() as session:
        await session.execute(delete(ProductEcommerceImage).where(ProductEcommerceImage.id == media_id))
        await session.commit()


async def get_ecommerce_media_image(media_id: int) -> Optional[bytes]:
    async with await get_session() as session:
        row = (
            await session.execute(
                select(ProductEcommerceImage.image_1920).where(ProductEcommerceImage.id == media_id)
            )
        ).first()
        return row[0] if row else None
