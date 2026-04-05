"""
Tests for Mashora exception to HTTP status code mapping.
"""
import pytest


class TestExceptionMapping:
    def test_imports(self):
        """Verify exception mapping module loads without Mashora."""
        from app.core.exceptions import MashoraErrorResponse
        err = MashoraErrorResponse(
            status_code=422,
            error_type="validation_error",
            message="Test error",
        )
        response = err.to_json_response()
        assert response.status_code == 422

    def test_error_response_structure(self):
        from app.core.exceptions import MashoraErrorResponse
        err = MashoraErrorResponse(
            status_code=404,
            error_type="missing_error",
            message="Record not found",
            details={"model": "res.partner", "id": 999},
        )
        resp = err.to_json_response()
        assert resp.status_code == 404

    def test_error_types(self):
        """Verify all expected error types can be constructed."""
        from app.core.exceptions import MashoraErrorResponse
        error_types = [
            (401, "access_denied"),
            (403, "access_error"),
            (404, "missing_error"),
            (409, "concurrency_error"),
            (422, "validation_error"),
            (422, "user_error"),
            (422, "redirect_warning"),
            (500, "cache_miss"),
            (500, "server_error"),
        ]
        for status, etype in error_types:
            err = MashoraErrorResponse(status_code=status, error_type=etype, message="test")
            assert err.status_code == status
            assert err.error_type == etype
