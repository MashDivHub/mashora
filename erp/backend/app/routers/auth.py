"""
Authentication endpoints for the ERP API.
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from app.core.orm_adapter import orm_call
from app.middleware.auth import (
    authenticate_user,
    create_access_token,
    create_refresh_token,
    verify_token,
    get_current_user,
    CurrentUser,
)

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    login: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: dict


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest):
    """Authenticate user and return JWT tokens."""
    user_data = await orm_call(authenticate_user, body.login, body.password)
    if not user_data:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token_data = {
        "sub": user_data["uid"],
        "login": user_data["login"],
        "company_id": user_data["company_id"],
        "company_ids": user_data["company_ids"],
        "lang": user_data["lang"],
        "tz": user_data["tz"],
    }

    return TokenResponse(
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data),
        user=user_data,
    )


@router.post("/refresh")
async def refresh_token(refresh_token: str):
    """Exchange a refresh token for a new access token."""
    payload = verify_token(refresh_token)
    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid token type")

    token_data = {
        "sub": payload["sub"],
        "login": payload.get("login"),
        "company_id": payload.get("company_id"),
        "company_ids": payload.get("company_ids", []),
        "lang": payload.get("lang", "en_US"),
        "tz": payload.get("tz", "UTC"),
    }

    return {
        "access_token": create_access_token(token_data),
        "refresh_token": create_refresh_token(token_data),
        "token_type": "bearer",
    }


@router.get("/me")
async def get_me(user: CurrentUser = Depends(get_current_user)):
    """Get current user info."""
    from app.core.orm_adapter import read_record
    user_data = await orm_call(
        read_record,
        model="res.users",
        record_id=user.uid,
        fields=["name", "login", "email", "lang", "tz", "company_id", "company_ids", "image_128"],
        uid=user.uid,
        context=user.get_context(),
    )
    return user_data
