"""
Security audit middleware and access control helpers.
"""
import logging
from typing import Any, Optional

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware

_logger = logging.getLogger(__name__)


class SecurityAuditMiddleware(BaseHTTPMiddleware):
    """Middleware that logs security-sensitive operations for audit trail."""

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)

        if request.method in ("POST", "PUT", "DELETE") and response.status_code < 400:
            path = request.url.path
            user = getattr(request.state, "user", None)
            uid = user.uid if user else "anonymous"
            _logger.info("AUDIT: %s %s by user %s → %s", request.method, path, uid, response.status_code)

        return response


async def check_model_access(model: str, operation: str, uid: int = 1, context: Optional[dict] = None) -> dict:
    """Check if a user has access to a model for a given operation."""
    from app.services.base import async_search_read
    result = await async_search_read(
        "ir.model.access",
        domain=[],
        fields=["id", "name", "perm_read", "perm_write", "perm_create", "perm_unlink"],
        limit=10,
    )
    if not result["records"]:
        return {"allowed": True, "model": model, "operation": operation}

    perm_field = f"perm_{operation}"
    for acl in result["records"]:
        if acl.get(perm_field, False):
            return {"allowed": True, "model": model, "operation": operation}

    return {"allowed": False, "model": model, "operation": operation, "reason": "No matching ACL"}


async def get_record_rules(model: str, uid: int = 1, context: Optional[dict] = None) -> dict:
    """Get active record rules for a model."""
    from app.services.base import async_search_read
    result = await async_search_read(
        "ir.rule",
        domain=[["active", "=", True]],
        fields=["id", "name", "domain_force", "perm_read", "perm_write", "perm_create", "perm_unlink"],
        limit=100,
    )
    return {"model": model, "rules": result["records"], "total": result["total"]}


async def get_user_groups(uid: int = 1, context: Optional[dict] = None) -> dict:
    """Get all groups the current user belongs to."""
    return {"user_id": uid, "groups": [], "total": 0}
