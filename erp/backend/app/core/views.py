"""
View architecture parser.

Converts Mashora's XML view definitions (arch) into JSON structures
that the React frontend can use to dynamically render forms, lists, and kanban views.
"""
import logging
from typing import Any
from xml.etree import ElementTree as ET

from app.core.orm_adapter import mashora_env

_logger = logging.getLogger(__name__)


def get_view_definition(
    model: str,
    view_type: str = "form",
    view_id: Optional[int] = None,
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict:
    """
    Get a view definition for a model, parsed from XML arch to JSON.

    Args:
        model: Model name (e.g., 'res.partner')
        view_type: View type ('form', 'list', 'kanban', 'search')
        view_id: Specific view ID (optional, uses default if None)
        uid: User ID
        context: Optional context

    Returns:
        JSON structure describing the view layout and fields.
    """
    with mashora_env(uid=uid, context=context) as env:
        Model = env[model]

        # Get the view using Mashora's built-in method
        if view_id:
            view = env["ir.ui.view"].browse(view_id)
            arch = view.arch
            view_data = {"id": view.id, "name": view.name, "type": view.type}
        else:
            result = Model.get_view(view_type=view_type)
            arch = result.get("arch", "")
            view_data = {
                "id": result.get("view_id"),
                "name": result.get("name", ""),
                "type": view_type,
            }

        # Parse the XML arch
        try:
            parsed = parse_arch(arch)
        except Exception as e:
            _logger.warning("Failed to parse arch for %s/%s: %s", model, view_type, e)
            parsed = {"raw": arch}

        # Get field metadata
        fields_data = Model.fields_get(attributes=["string", "type", "required", "readonly", "help", "selection", "relation"])

        return {
            "model": model,
            "view": view_data,
            "arch": parsed,
            "fields": fields_data,
        }


def parse_arch(arch_xml: str) -> dict:
    """
    Parse a Mashora XML arch string into a JSON-friendly structure.

    Converts elements like:
        <form><group><field name="name"/></group></form>
    Into:
        {"tag": "form", "children": [{"tag": "group", "children": [...]}]}
    """
    if not arch_xml or not arch_xml.strip():
        return {}

    root = ET.fromstring(arch_xml)
    return _parse_element(root)


def _parse_element(element: ET.Element) -> dict:
    """Recursively parse an XML element into a dict."""
    result: dict[str, Any] = {
        "tag": element.tag,
    }

    # Copy all attributes
    if element.attrib:
        attrs = dict(element.attrib)
        result["attrs"] = attrs

        # Extract commonly used attributes to top level for convenience
        if "name" in attrs:
            result["name"] = attrs["name"]
        if "string" in attrs:
            result["string"] = attrs["string"]
        if "invisible" in attrs:
            result["invisible"] = attrs["invisible"]
        if "readonly" in attrs:
            result["readonly"] = attrs["readonly"]
        if "required" in attrs:
            result["required"] = attrs["required"]
        if "widget" in attrs:
            result["widget"] = attrs["widget"]
        if "colspan" in attrs:
            result["colspan"] = attrs["colspan"]
        if "col" in attrs:
            result["col"] = attrs["col"]
        if "nolabel" in attrs:
            result["nolabel"] = attrs["nolabel"]

    # Parse children
    children = []
    for child in element:
        children.append(_parse_element(child))

    if children:
        result["children"] = children

    # Text content
    if element.text and element.text.strip():
        result["text"] = element.text.strip()

    return result


def get_search_view(model: str, uid: int = 1, context: Optional[dict] = None) -> dict:
    """Get the search view filters and group-by options for a model."""
    with mashora_env(uid=uid, context=context) as env:
        Model = env[model]
        result = Model.get_view(view_type="search")
        arch = result.get("arch", "")

        filters = []
        group_bys = []

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

        return {
            "model": model,
            "filters": filters,
            "group_bys": group_bys,
        }
