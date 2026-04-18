"""
Chatter (mail.thread) API endpoints.

Provides REST API for the messaging/activity system that's embedded
in every business record (143 models inherit mail.thread).
"""
import logging
from typing import Any, Optional

from fastapi import APIRouter, Depends, Query

_logger = logging.getLogger(__name__)
from pydantic import BaseModel, Field

from app.middleware.auth import get_current_user, get_optional_user, CurrentUser
from app.services.base import async_search_read, async_create, async_update, async_delete, async_get
from app.services.bus_events import broadcast

router = APIRouter(prefix="/chatter", tags=["chatter"])


def _uid(user: CurrentUser | None) -> int:
    return user.uid if user else 1


class MessagePost(BaseModel):
    body: str
    message_type: str = "comment"
    subtype_xmlid: str = "mail.mt_comment"


class ActivityCreate(BaseModel):
    activity_type_id: int
    summary: str | None = None
    note: str | None = None
    date_deadline: str | None = None
    user_id: int | None = None


# --- Messages ---

async def _get_messages(model: str, res_id: int, limit: int = 30, offset: int = 0) -> dict:
    result = await async_search_read(
        "mail.message",
        domain=[["model", "=", model], ["res_id", "=", res_id]],
        fields=["id", "body", "date", "author_id", "message_type",
                "subtype_id", "email_from", "subject", "attachment_ids"],
        offset=offset,
        limit=limit,
        order="date desc",
    )
    return {"messages": result["records"], "total": result["total"]}


async def _post_message(model: str, res_id: int, body: str, message_type: str = "comment",
                        subtype_xmlid: str = "mail.mt_comment", uid: int = 1) -> dict:
    vals = {
        "model": model,
        "res_id": res_id,
        "body": body,
        "message_type": message_type,
        "author_id": uid,
    }
    result = await async_create("mail.message", vals=vals, uid=uid)
    return result


# --- Followers ---

async def _get_followers(model: str, res_id: int) -> dict:
    try:
        result = await async_search_read(
            "mail.followers",
            domain=[["res_model", "=", model], ["res_id", "=", res_id]],
            fields=["id", "partner_id"],
        )
        return {"followers": result["records"], "total": result["total"]}
    except Exception as e:
        _logger.warning("Failed to get followers for %s/%s: %s", model, res_id, e)
        return {"followers": [], "total": 0}


async def _add_follower(model: str, res_id: int, partner_id: int, uid: int = 1) -> dict:
    vals = {"res_model": model, "res_id": res_id, "partner_id": partner_id}
    await async_create("mail.followers", vals=vals, uid=uid)
    return {"subscribed": True, "partner_id": partner_id}


async def _remove_follower(model: str, res_id: int, partner_id: int) -> dict:
    result = await async_search_read(
        "mail.followers",
        domain=[["res_model", "=", model], ["res_id", "=", res_id], ["partner_id", "=", partner_id]],
        fields=["id"],
        limit=1,
    )
    if result["records"]:
        await async_delete("mail.followers", result["records"][0]["id"])
    return {"unsubscribed": True, "partner_id": partner_id}


# --- Activities ---

async def _get_activities(model: str, res_id: int) -> dict:
    result = await async_search_read(
        "mail.activity",
        domain=[["res_model", "=", model], ["res_id", "=", res_id]],
        fields=["id", "activity_type_id", "summary", "note",
                "date_deadline", "user_id", "state", "create_date"],
        order="date_deadline asc",
    )
    return {"activities": result["records"], "total": result["total"]}


async def _create_activity(model: str, res_id: int, vals: dict, uid: int = 1) -> dict:
    vals["res_model"] = model
    vals["res_id"] = res_id
    result = await async_create("mail.activity", vals=vals, uid=uid,
                                fields=["id", "activity_type_id", "summary", "date_deadline", "user_id", "state"])
    return result


async def _mark_activity_done(activity_id: int, uid: int = 1) -> dict:
    await async_update("mail.activity", activity_id, {"state": "done"}, uid=uid)
    return {"done": True, "activity_id": activity_id}


async def _get_activity_types() -> dict:
    result = await async_search_read(
        "mail.activity.type",
        domain=[],
        fields=["id", "name", "summary", "icon"],
    )
    return {"types": result["records"]}


# --- Tracking Values ---

async def _get_tracking(model: str, res_id: int) -> dict:
    result = await async_search_read(
        "mail.message",
        domain=[["model", "=", model], ["res_id", "=", res_id]],
        fields=["id", "date", "author_id"],
        order="date desc",
        limit=50,
    )
    return {"tracking": result["records"]}


# --- Endpoints ---

@router.get("/{model_name}/{res_id}/messages")
async def get_messages(
    model_name: str, res_id: int,
    limit: int = Query(default=30, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    user: CurrentUser | None = Depends(get_optional_user),
):
    """Get messages/chatter for a record."""
    return await _get_messages(model=model_name, res_id=res_id, limit=limit, offset=offset)


@router.post("/{model_name}/{res_id}/messages")
async def post_message(model_name: str, res_id: int, body: MessagePost, user: CurrentUser | None = Depends(get_optional_user)):
    """Post a message on a record's chatter."""
    uid = _uid(user)
    result = await _post_message(
        model=model_name, res_id=res_id,
        body=body.body, message_type=body.message_type, subtype_xmlid=body.subtype_xmlid,
        uid=uid,
    )
    # Broadcast to bus for realtime updates (Discuss + Chatter live invalidation).
    new_msg_id = result.get("id") if isinstance(result, dict) else None
    if model_name == "discuss.channel":
        await broadcast("discuss.message", {
            "channel_id": res_id,
            "message_id": new_msg_id,
            "author_id": uid,
        })
    else:
        await broadcast("chatter.message", {
            "model": model_name,
            "res_id": res_id,
            "message_id": new_msg_id,
            "author_id": uid,
        })
    return result


@router.get("/{model_name}/{res_id}/followers")
async def get_followers(model_name: str, res_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    """Get followers of a record."""
    return await _get_followers(model=model_name, res_id=res_id)


@router.post("/{model_name}/{res_id}/followers/{partner_id}")
async def add_follower(model_name: str, res_id: int, partner_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    """Subscribe a partner to a record."""
    return await _add_follower(model=model_name, res_id=res_id, partner_id=partner_id, uid=_uid(user))


@router.delete("/{model_name}/{res_id}/followers/{partner_id}")
async def remove_follower(model_name: str, res_id: int, partner_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    """Unsubscribe a partner from a record."""
    return await _remove_follower(model=model_name, res_id=res_id, partner_id=partner_id)


@router.get("/{model_name}/{res_id}/activities")
async def get_activities(model_name: str, res_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    """Get activities for a record."""
    return await _get_activities(model=model_name, res_id=res_id)


@router.post("/{model_name}/{res_id}/activities")
async def create_activity(model_name: str, res_id: int, body: ActivityCreate, user: CurrentUser | None = Depends(get_optional_user)):
    """Create an activity on a record."""
    return await _create_activity(model=model_name, res_id=res_id, vals=body.model_dump(exclude_none=True), uid=_uid(user))


@router.post("/activities/{activity_id}/done")
async def complete_activity(activity_id: int, feedback: str | None = Query(default=None), user: CurrentUser | None = Depends(get_optional_user)):
    """Mark an activity as done."""
    return await _mark_activity_done(activity_id=activity_id, uid=_uid(user))


@router.get("/activity-types")
async def get_activity_types(user: CurrentUser | None = Depends(get_optional_user)):
    """List available activity types."""
    return await _get_activity_types()


@router.get("/{model_name}/{res_id}/tracking")
async def get_tracking(model_name: str, res_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    """Get field change tracking history for a record."""
    return await _get_tracking(model=model_name, res_id=res_id)
