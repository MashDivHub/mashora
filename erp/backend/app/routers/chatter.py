"""
Chatter (mail.thread) API endpoints.

Provides REST API for the messaging/activity system that's embedded
in every business record (143 models inherit mail.thread).
"""
from typing import Any, Optional

from fastapi import APIRouter, Query
from pydantic import BaseModel, Field

from app.core.orm_adapter import orm_call, mashora_env

router = APIRouter(prefix="/chatter", tags=["chatter"])


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

def _get_messages(model: str, res_id: int, limit: int = 30, offset: int = 0, uid: int = 1, context: Optional[dict] = None) -> dict:
    with mashora_env(uid=uid, context=context) as env:
        Message = env["mail.message"]
        domain = [("model", "=", model), ("res_id", "=", res_id)]
        total = Message.search_count(domain)
        records = Message.search(domain, limit=limit, offset=offset, order="date desc")
        data = records.read([
            "id", "body", "date", "author_id", "message_type",
            "subtype_id", "email_from", "subject",
            "tracking_value_ids", "attachment_ids",
            "starred", "needaction",
        ])
        return {"messages": data, "total": total}


def _post_message(model: str, res_id: int, body: str, message_type: str = "comment",
                   subtype_xmlid: str = "mail.mt_comment", uid: int = 1, context: Optional[dict] = None) -> dict:
    with mashora_env(uid=uid, context=context) as env:
        record = env[model].browse(res_id)
        msg = record.message_post(
            body=body,
            message_type=message_type,
            subtype_xmlid=subtype_xmlid,
        )
        return msg.read(["id", "body", "date", "author_id", "message_type"])[0]


# --- Followers ---

def _get_followers(model: str, res_id: int, uid: int = 1, context: Optional[dict] = None) -> dict:
    with mashora_env(uid=uid, context=context) as env:
        Follower = env["mail.followers"]
        domain = [("res_model", "=", model), ("res_id", "=", res_id)]
        records = Follower.search(domain)
        data = records.read(["id", "partner_id", "channel_id", "subtype_ids"])
        return {"followers": data, "total": len(data)}


def _add_follower(model: str, res_id: int, partner_id: int, uid: int = 1, context: Optional[dict] = None) -> dict:
    with mashora_env(uid=uid, context=context) as env:
        record = env[model].browse(res_id)
        record.message_subscribe(partner_ids=[partner_id])
        return {"subscribed": True, "partner_id": partner_id}


def _remove_follower(model: str, res_id: int, partner_id: int, uid: int = 1, context: Optional[dict] = None) -> dict:
    with mashora_env(uid=uid, context=context) as env:
        record = env[model].browse(res_id)
        record.message_unsubscribe(partner_ids=[partner_id])
        return {"unsubscribed": True, "partner_id": partner_id}


# --- Activities ---

def _get_activities(model: str, res_id: int, uid: int = 1, context: Optional[dict] = None) -> dict:
    with mashora_env(uid=uid, context=context) as env:
        Activity = env["mail.activity"]
        domain = [("res_model", "=", model), ("res_id", "=", res_id)]
        records = Activity.search(domain, order="date_deadline asc")
        data = records.read([
            "id", "activity_type_id", "summary", "note",
            "date_deadline", "user_id", "state",
            "create_date",
        ])
        return {"activities": data, "total": len(data)}


def _create_activity(model: str, res_id: int, vals: dict, uid: int = 1, context: Optional[dict] = None) -> dict:
    with mashora_env(uid=uid, context=context) as env:
        vals["res_model_id"] = env["ir.model"]._get_id(model)
        vals["res_id"] = res_id
        activity = env["mail.activity"].create(vals)
        return activity.read(["id", "activity_type_id", "summary", "date_deadline", "user_id", "state"])[0]


def _mark_activity_done(activity_id: int, feedback: str | None = None, uid: int = 1, context: Optional[dict] = None) -> dict:
    with mashora_env(uid=uid, context=context) as env:
        activity = env["mail.activity"].browse(activity_id)
        activity.action_feedback(feedback=feedback or "")
        return {"done": True, "activity_id": activity_id}


def _get_activity_types(uid: int = 1, context: Optional[dict] = None) -> dict:
    with mashora_env(uid=uid, context=context) as env:
        types = env["mail.activity.type"].search([])
        return {"types": types.read(["id", "name", "summary", "delay_count", "delay_unit", "icon"])}


# --- Tracking Values (field change log) ---

def _get_tracking(model: str, res_id: int, uid: int = 1, context: Optional[dict] = None) -> dict:
    with mashora_env(uid=uid, context=context) as env:
        Message = env["mail.message"]
        domain = [
            ("model", "=", model),
            ("res_id", "=", res_id),
            ("tracking_value_ids", "!=", False),
        ]
        messages = Message.search(domain, order="date desc", limit=50)
        result = []
        for msg in messages:
            tracking = msg.tracking_value_ids.read([
                "id", "field_id", "field_desc", "field_type",
                "old_value_char", "new_value_char",
                "old_value_integer", "new_value_integer",
                "old_value_float", "new_value_float",
                "old_value_datetime", "new_value_datetime",
            ])
            if tracking:
                msg_data = msg.read(["id", "date", "author_id"])[0]
                msg_data["tracking"] = tracking
                result.append(msg_data)
        return {"tracking": result}


# --- Endpoints ---

@router.get("/{model_name}/{res_id}/messages")
async def get_messages(
    model_name: str, res_id: int,
    limit: int = Query(default=30, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    """Get messages/chatter for a record."""
    return await orm_call(_get_messages, model=model_name, res_id=res_id, limit=limit, offset=offset)


@router.post("/{model_name}/{res_id}/messages")
async def post_message(model_name: str, res_id: int, body: MessagePost):
    """Post a message on a record's chatter."""
    return await orm_call(
        _post_message, model=model_name, res_id=res_id,
        body=body.body, message_type=body.message_type, subtype_xmlid=body.subtype_xmlid,
    )


@router.get("/{model_name}/{res_id}/followers")
async def get_followers(model_name: str, res_id: int):
    """Get followers of a record."""
    return await orm_call(_get_followers, model=model_name, res_id=res_id)


@router.post("/{model_name}/{res_id}/followers/{partner_id}")
async def add_follower(model_name: str, res_id: int, partner_id: int):
    """Subscribe a partner to a record."""
    return await orm_call(_add_follower, model=model_name, res_id=res_id, partner_id=partner_id)


@router.delete("/{model_name}/{res_id}/followers/{partner_id}")
async def remove_follower(model_name: str, res_id: int, partner_id: int):
    """Unsubscribe a partner from a record."""
    return await orm_call(_remove_follower, model=model_name, res_id=res_id, partner_id=partner_id)


@router.get("/{model_name}/{res_id}/activities")
async def get_activities(model_name: str, res_id: int):
    """Get activities for a record."""
    return await orm_call(_get_activities, model=model_name, res_id=res_id)


@router.post("/{model_name}/{res_id}/activities")
async def create_activity(model_name: str, res_id: int, body: ActivityCreate):
    """Create an activity on a record."""
    return await orm_call(_create_activity, model=model_name, res_id=res_id, vals=body.model_dump(exclude_none=True))


@router.post("/activities/{activity_id}/done")
async def complete_activity(activity_id: int, feedback: str | None = Query(default=None)):
    """Mark an activity as done."""
    return await orm_call(_mark_activity_done, activity_id=activity_id, feedback=feedback)


@router.get("/activity-types")
async def get_activity_types():
    """List available activity types."""
    return await orm_call(_get_activity_types)


@router.get("/{model_name}/{res_id}/tracking")
async def get_tracking(model_name: str, res_id: int):
    """Get field change tracking history for a record."""
    return await orm_call(_get_tracking, model=model_name, res_id=res_id)
