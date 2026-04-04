from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import (
    create_access_token,
    create_refresh_token,
    get_current_user,
    verify_token,
)
from app.models import Organization, User
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse, UserResponse
from app.schemas.auth import RefreshTokenRequest
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])


def _build_tokens(user: User) -> TokenResponse:
    subject = str(user.id)
    access_token = create_access_token({"sub": subject})
    refresh_token = create_refresh_token({"sub": subject})
    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


def _invalid_credentials_exception() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid email or password",
        headers={"WWW-Authenticate": "Bearer"},
    )


async def _authenticate_or_401(
    db: AsyncSession,
    email: str,
    password: str,
) -> User:
    user = await AuthService.authenticate(db, email, password)
    if user is None:
        raise _invalid_credentials_exception()
    return user


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(
    body: RegisterRequest,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    existing = await AuthService.authenticate(db, body.email, body.password)
    # authenticate returns None for wrong password too, so check by direct lookup
    from sqlalchemy import select
    from app.models import User as _User
    result = await db.execute(select(_User).where(_User.email == body.email))
    if result.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    user, _org = await AuthService.register(
        db=db,
        email=body.email,
        password=body.password,
        org_name=body.org_name,
    )
    return _build_tokens(user)


@router.post("/login", response_model=TokenResponse)
async def login(
    body: LoginRequest,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    user = await _authenticate_or_401(db, body.email, body.password)
    return _build_tokens(user)


@router.post("/login/form", response_model=TokenResponse, include_in_schema=False)
async def login_form(
    form: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    """OAuth2 password flow used by the OpenAPI docs 'Authorize' button."""
    user = await _authenticate_or_401(db, form.username, form.password)
    return _build_tokens(user)


@router.post("/token", response_model=TokenResponse, include_in_schema=False)
async def token(
    form: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    """Compatibility alias for frontend and OAuth2 password flows."""
    user = await _authenticate_or_401(db, form.username, form.password)
    return _build_tokens(user)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(
    body: RefreshTokenRequest | None = None,
    refresh_token: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    refresh_token_value = body.refresh_token if body else refresh_token
    if not refresh_token_value:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="refresh_token is required",
        )

    payload = verify_token(refresh_token_value)
    if payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user_id: str | None = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    from uuid import UUID
    user = await AuthService.get_user_by_id(db, UUID(user_id))
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return _build_tokens(user)


@router.get("/me", response_model=UserResponse)
async def me(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    result = await db.execute(
        select(Organization.name, Organization.status).where(Organization.id == current_user.org_id)
    )
    org = result.one_or_none()
    org_name = org.name if org else "Workspace"
    org_status = org.status if org else "active"
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        role=current_user.role,
        org_id=current_user.org_id,
        org_name=org_name,
        is_active=org_status == "active",
        created_at=current_user.created_at,
    )
