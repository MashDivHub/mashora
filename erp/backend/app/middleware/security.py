"""
ACL and Record Rules enforcement middleware.

While the ORM adapter naturally respects Mashora's security model
(because it runs with the user's UID), this middleware adds explicit
checking and logging for audit trails.
"""
import logging
from typing import Any, Optional

from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.orm_adapter import mashora_env, orm_call

_logger = logging.getLogger(__name__)


class SecurityAuditMiddleware(BaseHTTPMiddleware):
    """
    Middleware that logs security-sensitive operations for audit trail.
    The actual ACL enforcement happens in the Mashora ORM layer —
    this middleware adds observability.
    """

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)

        # Log write operations for audit
        if request.method in ("POST", "PUT", "DELETE") and response.status_code < 400:
            path = request.url.path
            user = getattr(request.state, "user", None)
            uid = user.uid if user else "anonymous"
            _logger.info("AUDIT: %s %s by user %s → %s", request.method, path, uid, response.status_code)

        return response


def check_model_access(model: str, operation: str, uid: int = 1, context: Optional[dict] = None) -> dict:
    """
    Explicitly check if a user has access to a model for a given operation.

    Operations: 'read', 'write', 'create', 'unlink'
    Returns: {"allowed": True/False, "model": model, "operation": operation}
    """
    with mashora_env(uid=uid, context=context) as env:
        try:
            Model = env[model]
            Model.check_access_rights(operation, raise_exception=True)
            return {"allowed": True, "model": model, "operation": operation}
        except Exception as e:
            return {"allowed": False, "model": model, "operation": operation, "reason": str(e)}


def get_record_rules(model: str, uid: int = 1, context: Optional[dict] = None) -> dict:
    """Get active record rules for a model and user."""
    with mashora_env(uid=uid, context=context) as env:
        Rule = env["ir.rule"]
        model_id = env["ir.model"]._get_id(model)
        rules = Rule.search([("model_id", "=", model_id), ("active", "=", True)])
        data = rules.read(["id", "name", "domain_force", "groups", "perm_read", "perm_write", "perm_create", "perm_unlink"])
        return {"model": model, "rules": data, "total": len(data)}


def get_user_groups(uid: int = 1, context: Optional[dict] = None) -> dict:
    """Get all groups the current user belongs to."""
    with mashora_env(uid=uid, context=context) as env:
        user = env["res.users"].browse(uid)
        groups = user.groups_id.read(["id", "name", "full_name", "category_id"])
        return {"user_id": uid, "groups": groups, "total": len(groups)}
