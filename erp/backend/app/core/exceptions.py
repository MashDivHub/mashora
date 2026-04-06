"""
Exception mapping from Mashora ORM exceptions to FastAPI HTTP responses.

Maps Mashora's exception hierarchy to appropriate HTTP status codes:
- UserError (422) → 422 Unprocessable Entity
- AccessError (403) → 403 Forbidden
- AccessDenied (403) → 401 Unauthorized (login failures)
- MissingError (404) → 404 Not Found
- ValidationError (422) → 422 Unprocessable Entity
- LockError (409) → 409 Conflict
- ConcurrencyError → 409 Conflict (retry)
- RedirectWarning → 422 with redirect action
"""
import logging
from typing import Any, Optional

from fastapi import Request
from fastapi.responses import JSONResponse

_logger = logging.getLogger(__name__)


class MashoraErrorResponse:
    """Structured error response from a Mashora exception."""

    def __init__(
        self,
        status_code: int,
        error_type: str,
        message: str,
        details: Optional[dict[str, Any]] = None,
    ):
        self.status_code = status_code
        self.error_type = error_type
        self.message = message
        self.details = details or {}

    def to_json_response(self) -> JSONResponse:
        return JSONResponse(
            status_code=self.status_code,
            content={
                "error": {
                    "type": self.error_type,
                    "message": self.message,
                    "details": self.details,
                }
            },
        )


def map_mashora_exception(exc: Exception) -> MashoraErrorResponse:
    """Map a Mashora exception to an HTTP error response."""
    # Import lazily to avoid import-time dependency on Mashora
    from mashora.exceptions import (
        AccessDenied,
        AccessError,
        CacheMiss,
        ConcurrencyError,
        LockError,
        MissingError,
        RedirectWarning,
        UserError,
        ValidationError,
    )

    if isinstance(exc, AccessDenied):
        return MashoraErrorResponse(
            status_code=401,
            error_type="access_denied",
            message=str(exc),
        )

    if isinstance(exc, AccessError):
        return MashoraErrorResponse(
            status_code=403,
            error_type="access_error",
            message=str(exc),
        )

    if isinstance(exc, MissingError):
        return MashoraErrorResponse(
            status_code=404,
            error_type="missing_error",
            message=str(exc),
        )

    if isinstance(exc, (LockError, ConcurrencyError)):
        return MashoraErrorResponse(
            status_code=409,
            error_type="concurrency_error",
            message=str(exc),
            details={"retry": True},
        )

    if isinstance(exc, ValidationError):
        return MashoraErrorResponse(
            status_code=422,
            error_type="validation_error",
            message=str(exc),
        )

    if isinstance(exc, RedirectWarning):
        args = exc.args
        return MashoraErrorResponse(
            status_code=422,
            error_type="redirect_warning",
            message=str(args[0]) if args else str(exc),
            details={
                "action_id": args[1] if len(args) > 1 else None,
                "button_text": args[2] if len(args) > 2 else None,
            },
        )

    if isinstance(exc, UserError):
        return MashoraErrorResponse(
            status_code=422,
            error_type="user_error",
            message=str(exc),
        )

    if isinstance(exc, CacheMiss):
        return MashoraErrorResponse(
            status_code=500,
            error_type="cache_miss",
            message="Internal cache error. Please retry.",
        )

    # Fallback for any unhandled Mashora exception
    _logger.exception("Unhandled Mashora exception: %s", exc)
    return MashoraErrorResponse(
        status_code=500,
        error_type="server_error",
        message="Internal server error.",
    )


async def mashora_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """FastAPI exception handler for Mashora exceptions."""
    response = map_mashora_exception(exc)
    return response.to_json_response()
