"""
Tests for JWT authentication middleware.

All tests are pure unit tests — no database connection required.
"""
import pytest
from datetime import timedelta

from fastapi import HTTPException

from app.middleware.auth import (
    create_access_token,
    create_refresh_token,
    verify_token,
    CurrentUser,
)


def _decode_token_payload(token: str) -> dict:
    """Decode a JWT token directly, skipping sub-type validation."""
    from jose import jwt
    from app.config import get_settings
    settings = get_settings()
    return jwt.decode(
        token,
        settings.jwt_secret_key,
        algorithms=[settings.jwt_algorithm],
        options={"verify_sub": False},
    )


# ---------------------------------------------------------------------------
# Token creation
# ---------------------------------------------------------------------------

class TestCreateAccessToken:
    def test_returns_string(self):
        token = create_access_token({"sub": 1})
        assert isinstance(token, str)
        assert len(token) > 20

    def test_contains_three_jwt_parts(self):
        token = create_access_token({"sub": 1})
        parts = token.split(".")
        assert len(parts) == 3

    def test_access_token_type_in_payload(self):
        token = create_access_token({"sub": 1, "company_id": 1})
        payload = _decode_token_payload(token)
        assert payload["type"] == "access"

    def test_token_contains_sub_claim(self):
        token = create_access_token({"sub": 42})
        payload = _decode_token_payload(token)
        assert payload["sub"] == 42

    def test_token_contains_company_id(self):
        token = create_access_token({"sub": 1, "company_id": 7})
        payload = _decode_token_payload(token)
        assert payload["company_id"] == 7

    def test_token_contains_exp(self):
        token = create_access_token({"sub": 1})
        payload = _decode_token_payload(token)
        assert "exp" in payload

    def test_custom_expiry(self):
        token = create_access_token({"sub": 1}, expires_delta=timedelta(seconds=30))
        payload = _decode_token_payload(token)
        assert payload["sub"] == 1

    def test_multiple_tokens_differ(self):
        t1 = create_access_token({"sub": 1})
        t2 = create_access_token({"sub": 2})
        assert t1 != t2


class TestCreateRefreshToken:
    def test_returns_string(self):
        token = create_refresh_token({"sub": 1})
        assert isinstance(token, str)

    def test_refresh_token_type(self):
        token = create_refresh_token({"sub": 1})
        payload = _decode_token_payload(token)
        assert payload["type"] == "refresh"

    def test_refresh_token_contains_sub(self):
        token = create_refresh_token({"sub": 99})
        payload = _decode_token_payload(token)
        assert payload["sub"] == 99

    def test_access_and_refresh_differ(self):
        access = create_access_token({"sub": 1})
        refresh = create_refresh_token({"sub": 1})
        assert access != refresh


# ---------------------------------------------------------------------------
# Token verification (verify_token wraps jwt.decode WITH sub validation,
# so we need to pass sub as a string to avoid JWTClaimsError)
# ---------------------------------------------------------------------------

class TestVerifyToken:
    def test_verify_valid_token_returns_dict(self):
        # verify_token enforces sub must be string — use string sub
        token = create_access_token({"sub": "1"})
        payload = verify_token(token)
        assert isinstance(payload, dict)
        assert payload["sub"] == "1"

    def test_verify_expired_token_raises_401(self):
        token = create_access_token({"sub": "1"}, expires_delta=timedelta(seconds=-1))
        with pytest.raises(HTTPException) as exc_info:
            verify_token(token)
        assert exc_info.value.status_code == 401

    def test_verify_invalid_string_raises_401(self):
        with pytest.raises(HTTPException) as exc_info:
            verify_token("this.is.not.a.valid.jwt")
        assert exc_info.value.status_code == 401

    def test_verify_empty_string_raises_401(self):
        with pytest.raises(HTTPException) as exc_info:
            verify_token("")
        assert exc_info.value.status_code == 401

    def test_verify_garbage_raises_401(self):
        with pytest.raises(HTTPException) as exc_info:
            verify_token("aaaabbbbcccc")
        assert exc_info.value.status_code == 401

    def test_verify_tampered_token_raises_401(self):
        token = create_access_token({"sub": "1"})
        parts = token.split(".")
        tampered = parts[0] + "." + parts[1] + ".invalidsignature"
        with pytest.raises(HTTPException) as exc_info:
            verify_token(tampered)
        assert exc_info.value.status_code == 401


# ---------------------------------------------------------------------------
# CurrentUser context
# ---------------------------------------------------------------------------

class TestCurrentUser:
    def test_get_context_returns_dict(self):
        user = CurrentUser(uid=1, company_id=1, company_ids=[1], lang="en_US", tz="UTC")
        ctx = user.get_context()
        assert isinstance(ctx, dict)

    def test_get_context_has_lang(self):
        user = CurrentUser(uid=1, company_id=1, company_ids=[1], lang="fr_FR", tz="Europe/Paris")
        ctx = user.get_context()
        assert ctx["lang"] == "fr_FR"

    def test_get_context_has_tz(self):
        user = CurrentUser(uid=1, company_id=1, company_ids=[1], lang="en_US", tz="America/New_York")
        ctx = user.get_context()
        assert ctx["tz"] == "America/New_York"

    def test_get_context_has_allowed_company_ids(self):
        user = CurrentUser(uid=1, company_id=1, company_ids=[1, 2, 3], lang="en_US", tz="UTC")
        ctx = user.get_context()
        assert ctx["allowed_company_ids"] == [1, 2, 3]

    def test_get_context_no_company_ids_omits_key(self):
        user = CurrentUser(uid=1, company_id=None, company_ids=[], lang="en_US", tz="UTC")
        ctx = user.get_context()
        assert "allowed_company_ids" not in ctx

    def test_uid_stored(self):
        user = CurrentUser(uid=42, company_id=5, company_ids=[5], lang="en_US", tz="UTC")
        assert user.uid == 42

    def test_company_id_stored(self):
        user = CurrentUser(uid=1, company_id=7, company_ids=[7], lang="en_US", tz="UTC")
        assert user.company_id == 7
