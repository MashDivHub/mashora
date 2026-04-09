"""
Bus event broadcasting helpers.
Provides fire-and-forget event emission for CRUD operations.
"""
import logging
from typing import Any, Optional

_logger = logging.getLogger(__name__)

# Reference to the connection manager — set during app startup
_manager = None


def set_bus_manager(manager):
    """Called during app startup to register the WebSocket connection manager."""
    global _manager
    _manager = manager


async def broadcast(channel: str, data: dict[str, Any]) -> None:
    """Broadcast a message to a WebSocket channel. Fire-and-forget."""
    if _manager is None:
        return
    try:
        await _manager.broadcast(channel, data)
    except Exception:
        _logger.debug("Bus broadcast failed for channel %s", channel, exc_info=True)


async def notify_record_change(
    model: str,
    record_id: int,
    action: str,  # "create", "update", "delete"
    uid: int = 1,
    changed_fields: Optional[list[str]] = None,
) -> None:
    """Broadcast a record change event."""
    await broadcast("record_update", {
        "model": model,
        "id": record_id,
        "action": action,
        "uid": uid,
        "fields": changed_fields or [],
    })

    # Also send a human-readable notification for important models
    NOTIFY_MODELS = {
        "sale.order": "Sales Order",
        "purchase.order": "Purchase Order",
        "account.move": "Invoice",
        "stock.picking": "Transfer",
        "crm.lead": "Lead/Opportunity",
        "hr.leave": "Leave Request",
        "project.task": "Task",
        "mrp.production": "Production Order",
    }

    model_label = NOTIFY_MODELS.get(model)
    if model_label:
        action_labels = {"create": "created", "update": "updated", "delete": "deleted"}
        await broadcast("notification", {
            "title": f"{model_label} {action_labels.get(action, action)}",
            "body": f"{model_label} #{record_id} was {action_labels.get(action, action)}",
            "model": model,
            "res_id": record_id,
        })
