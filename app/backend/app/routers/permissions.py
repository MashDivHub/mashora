"""Permissions management: Groups, ACL, Record Rules — full CRUD."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from sqlalchemy import text

from app.middleware.auth import get_current_user, CurrentUser
from app.services.base import async_search_read, async_get_or_raise, async_create, async_update, async_delete
from app.db.session import _get_session_factory

router = APIRouter(prefix="/permissions", tags=["permissions"])


# ── Helpers ──

@router.get("/models")
async def list_models(user: CurrentUser = Depends(get_current_user)):
    """List all ir.model records for dropdowns."""
    result = await async_search_read(
        "ir.model",
        domain=[],
        fields=["id", "name", "model"],
        limit=500,
        order="model asc",
    )
    return result


# ══════════════════════════════════════════════════════════════════════════════
# Groups
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/groups")
async def list_groups(user: CurrentUser = Depends(get_current_user)):
    """List all groups with user count."""
    result = await async_search_read(
        "res.groups",
        domain=[],
        fields=["id", "name", "comment"],
        limit=200,
        order="name asc",
    )
    factory = _get_session_factory()
    async with factory() as session:
        rows = await session.execute(text("SELECT gid, count(*) FROM res_groups_users_rel GROUP BY gid"))
        counts = dict(rows.fetchall())
    for rec in result.get("records", []):
        rec["user_count"] = counts.get(rec["id"], 0)
    return result


@router.get("/groups/{group_id}")
async def get_group(group_id: int, user: CurrentUser = Depends(get_current_user)):
    """Get group detail with users."""
    data = await async_get_or_raise("res.groups", group_id)
    factory = _get_session_factory()
    async with factory() as session:
        rows = await session.execute(
            text(
                "SELECT u.id, u.login, p.name "
                "FROM res_groups_users_rel rel "
                "JOIN res_users u ON rel.uid = u.id "
                "LEFT JOIN res_partner p ON u.partner_id = p.id "
                "WHERE rel.gid = :gid AND u.active = true "
                "ORDER BY u.login"
            ),
            {"gid": group_id},
        )
        users = [{"id": r[0], "login": r[1], "name": r[2]} for r in rows.fetchall()]
    data["users"] = users
    return data


class GroupCreate(BaseModel):
    name: str
    comment: Optional[str] = None


class GroupUpdate(BaseModel):
    name: Optional[str] = None
    comment: Optional[str] = None


@router.post("/groups")
async def create_group(body: GroupCreate, user: CurrentUser = Depends(get_current_user)):
    """Create a new group."""
    return await async_create("res.groups", {"name": body.name, "comment": body.comment or ""}, uid=user.uid)


@router.put("/groups/{group_id}")
async def update_group(group_id: int, body: GroupUpdate, user: CurrentUser = Depends(get_current_user)):
    vals = {k: v for k, v in body.model_dump().items() if v is not None}
    if vals:
        return await async_update("res.groups", group_id, vals, uid=user.uid)
    return {"ok": True}


@router.delete("/groups/{group_id}")
async def delete_group(group_id: int, user: CurrentUser = Depends(get_current_user)):
    """Delete a group. Cascade removes user assignments."""
    await async_delete("res.groups", group_id)
    return {"ok": True}


class AddUserToGroup(BaseModel):
    user_id: int


@router.post("/groups/{group_id}/users")
async def add_user_to_group(group_id: int, body: AddUserToGroup, user: CurrentUser = Depends(get_current_user)):
    factory = _get_session_factory()
    async with factory() as session:
        await session.execute(
            text("INSERT INTO res_groups_users_rel (gid, uid) VALUES (:gid, :uid) ON CONFLICT DO NOTHING"),
            {"gid": group_id, "uid": body.user_id},
        )
        await session.commit()
    return {"ok": True}


@router.delete("/groups/{group_id}/users/{user_id}")
async def remove_user_from_group(group_id: int, user_id: int, user: CurrentUser = Depends(get_current_user)):
    factory = _get_session_factory()
    async with factory() as session:
        await session.execute(
            text("DELETE FROM res_groups_users_rel WHERE gid = :gid AND uid = :uid"),
            {"gid": group_id, "uid": user_id},
        )
        await session.commit()
    return {"ok": True}


# ══════════════════════════════════════════════════════════════════════════════
# ACL (ir.model.access)
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/acl")
async def list_acl(
    group_id: Optional[int] = None,
    model_id: Optional[int] = None,
    search: Optional[str] = None,
    user: CurrentUser = Depends(get_current_user),
):
    domain: list = []
    if group_id:
        domain.append(["group_id", "=", group_id])
    if model_id:
        domain.append(["model_id", "=", model_id])
    if search:
        domain.append(["name", "ilike", search])
    result = await async_search_read(
        "ir.model.access",
        domain=domain,
        fields=["id", "name", "model_id", "group_id", "perm_read", "perm_write", "perm_create", "perm_unlink", "active"],
        limit=500,
        order="name asc",
    )
    return result


class AclCreate(BaseModel):
    name: str
    model_id: int
    group_id: Optional[int] = None
    perm_read: bool = True
    perm_write: bool = False
    perm_create: bool = False
    perm_unlink: bool = False


class AclUpdate(BaseModel):
    name: Optional[str] = None
    perm_read: Optional[bool] = None
    perm_write: Optional[bool] = None
    perm_create: Optional[bool] = None
    perm_unlink: Optional[bool] = None
    active: Optional[bool] = None


@router.post("/acl")
async def create_acl(body: AclCreate, user: CurrentUser = Depends(get_current_user)):
    """Create a new ACL rule."""
    vals = body.model_dump()
    if not vals.get("group_id"):
        vals["group_id"] = False
    return await async_create("ir.model.access", vals, uid=user.uid)


@router.put("/acl/{acl_id}")
async def update_acl(acl_id: int, body: AclUpdate, user: CurrentUser = Depends(get_current_user)):
    vals = {k: v for k, v in body.model_dump().items() if v is not None}
    if vals:
        return await async_update("ir.model.access", acl_id, vals, uid=user.uid)
    return {"ok": True}


@router.delete("/acl/{acl_id}")
async def delete_acl(acl_id: int, user: CurrentUser = Depends(get_current_user)):
    """Delete an ACL rule."""
    await async_delete("ir.model.access", acl_id)
    return {"ok": True}


# ══════════════════════════════════════════════════════════════════════════════
# Record Rules (ir.rule)
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/rules")
async def list_rules(
    model_id: Optional[int] = None,
    search: Optional[str] = None,
    user: CurrentUser = Depends(get_current_user),
):
    domain: list = []
    if model_id:
        domain.append(["model_id", "=", model_id])
    if search:
        domain.append(["name", "ilike", search])
    result = await async_search_read(
        "ir.rule",
        domain=domain,
        fields=["id", "name", "model_id", "domain_force", "active", "global", "perm_read", "perm_write", "perm_create", "perm_unlink"],
        limit=200,
        order="name asc",
    )
    return result


class RuleCreate(BaseModel):
    name: str
    model_id: int
    domain_force: Optional[str] = None
    global_rule: bool = True
    perm_read: bool = True
    perm_write: bool = True
    perm_create: bool = True
    perm_unlink: bool = True


class RuleUpdate(BaseModel):
    name: Optional[str] = None
    domain_force: Optional[str] = None
    active: Optional[bool] = None
    perm_read: Optional[bool] = None
    perm_write: Optional[bool] = None
    perm_create: Optional[bool] = None
    perm_unlink: Optional[bool] = None


@router.post("/rules")
async def create_rule(body: RuleCreate, user: CurrentUser = Depends(get_current_user)):
    """Create a new record rule."""
    vals = {
        "name": body.name,
        "model_id": body.model_id,
        "domain_force": body.domain_force or "[]",
        "global": body.global_rule,
        "perm_read": body.perm_read,
        "perm_write": body.perm_write,
        "perm_create": body.perm_create,
        "perm_unlink": body.perm_unlink,
        "active": True,
    }
    return await async_create("ir.rule", vals, uid=user.uid)


@router.put("/rules/{rule_id}")
async def update_rule(rule_id: int, body: RuleUpdate, user: CurrentUser = Depends(get_current_user)):
    vals = {k: v for k, v in body.model_dump().items() if v is not None}
    if vals:
        return await async_update("ir.rule", rule_id, vals, uid=user.uid)
    return {"ok": True}


@router.delete("/rules/{rule_id}")
async def delete_rule(rule_id: int, user: CurrentUser = Depends(get_current_user)):
    """Delete a record rule."""
    await async_delete("ir.rule", rule_id)
    return {"ok": True}
