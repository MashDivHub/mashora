"""
View architecture parser.

Converts Mashora's XML view definitions (arch) into JSON structures
that the React frontend can use to dynamically render forms, lists, and kanban views.

Now uses SQLAlchemy async to read ir_ui_view directly.
"""
import logging
from typing import Any, Optional
from xml.etree import ElementTree as ET

from app.services.base import async_get, async_search_read, get_session
from app.core.model_registry import get_model_class, get_fields_info

_logger = logging.getLogger(__name__)


async def get_view_definition(
    model: str,
    view_type: str = "form",
    view_id: Optional[int] = None,
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict:
    """
    Get a view definition for a model, parsed from XML arch to JSON.
    """
    if view_id:
        view_data = await async_get("ir.ui.view", view_id, ["id", "name", "type", "arch_db"])
        if not view_data:
            return {"model": model, "view": {}, "arch": {}, "fields": {}}
        arch = view_data.get("arch_db", "")
    else:
        # Find the default view for this model/type
        result = await async_search_read(
            "ir.ui.view",
            domain=[
                ["model", "=", model],
                ["type", "=", view_type],
                ["inherit_id", "=", False],
            ],
            fields=["id", "name", "type", "arch_db"],
            limit=1,
            order="priority asc, id asc",
        )
        if result["records"]:
            view_data = result["records"][0]
            arch = view_data.get("arch_db", "")
        else:
            view_data = {"id": None, "name": "", "type": view_type}
            arch = ""

    # Parse the XML arch
    try:
        parsed = parse_arch(arch) if arch else {}
    except Exception as e:
        _logger.warning("Failed to parse arch for %s/%s: %s", model, view_type, e)
        parsed = {"raw": arch}

    # Get field metadata from SQLAlchemy model registry
    fields_data = get_fields_info(model)

    return {
        "model": model,
        "view": {
            "id": view_data.get("id"),
            "name": view_data.get("name", ""),
            "type": view_data.get("type", view_type),
        },
        "arch": parsed,
        "fields": fields_data,
    }


def parse_arch(arch_xml: str) -> dict:
    """Parse a Mashora XML arch string into a JSON-friendly structure."""
    if not arch_xml or not arch_xml.strip():
        return {}
    root = ET.fromstring(arch_xml)
    return _parse_element(root)


def _parse_element(element: ET.Element) -> dict:
    """Recursively parse an XML element into a dict."""
    result: dict[str, Any] = {"tag": element.tag}

    if element.attrib:
        attrs = dict(element.attrib)
        result["attrs"] = attrs
        for attr in (
            "name", "string", "invisible", "readonly", "required",
            "widget", "colspan", "col", "nolabel", "class", "type",
            "confirm", "context", "for", "states", "domain",
            "options", "placeholder", "groups", "data-hotkey",
        ):
            if attr in attrs:
                key = "for_" if attr == "for" else attr
                result[key] = attrs[attr]

    children = [_parse_element(child) for child in element]
    if children:
        result["children"] = children

    if element.text and element.text.strip():
        result["text"] = element.text.strip()
    if element.tail and element.tail.strip():
        result["tail"] = element.tail.strip()

    return result


async def get_search_view(model: str, uid: int = 1, context: Optional[dict] = None) -> dict:
    """Get the search view filters and group-by options for a model."""
    result = await async_search_read(
        "ir.ui.view",
        domain=[
            ["model", "=", model],
            ["type", "=", "search"],
            ["inherit_id", "=", False],
        ],
        fields=["id", "arch_db"],
        limit=1,
        order="priority asc, id asc",
    )

    filters = []
    group_bys = []

    if result["records"]:
        arch = result["records"][0].get("arch_db", "")
        try:
            root = ET.fromstring(arch)
            for elem in root.iter():
                if elem.tag == "filter":
                    filters.append({
                        "name": elem.get("name", ""),
                        "string": elem.get("string", ""),
                        "domain": elem.get("domain", ""),
                        "context": elem.get("context", ""),
                    })
                elif elem.tag == "group" and elem.get("string"):
                    for sub in elem:
                        if sub.tag == "filter" and sub.get("context", "").startswith("{'group_by"):
                            group_bys.append({
                                "name": sub.get("name", ""),
                                "string": sub.get("string", ""),
                                "context": sub.get("context", ""),
                            })
        except Exception as e:
            _logger.warning("Failed to parse search view for %s: %s", model, e)

    return {"model": model, "filters": filters, "group_bys": group_bys}
