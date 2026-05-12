"""Authentication routes — register, login, refresh."""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.core.config import settings
from app.db.models.user import User, UserRole
from app.services.workspace_bootstrap import create_personal_workspace_for_user
from app.schemas.auth import LoginRequest, RefreshRequest, RegisterRequest, TokenResponse
from app.security.password import hash_password, verify_password
from app.security.tokens import (
    TOKEN_TYPE_REFRESH,
    create_access_token,
    create_refresh_token,
    decode_token,
)

router = APIRouter()


def _issue_tokens(user: User) -> TokenResponse:
    access = create_access_token(
        user_id=user.id,
        role_value=user.role.value,
    )
    refresh = create_refresh_token(user_id=user.id)
    return TokenResponse(
        access_token=access,
        refresh_token=refresh,
        expires_in=settings.API_JWT_ACCESS_TTL_SECONDS,
    )


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    """Create a new family member account.

    Self-registration always assigns ``family`` role — admins/guests/children are
    promoted by an administrator (future CLI / admin endpoint).
    """
    email = body.email.lower().strip()
    user = User(
        email=email,
        hashed_password=hash_password(body.password),
        display_name=body.display_name.strip(),
        role=UserRole.family,
    )
    db.add(user)
    await db.flush()
    await create_personal_workspace_for_user(db, user)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        ) from exc
    await db.refresh(user)
    return _issue_tokens(user)


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    email = body.email.lower().strip()
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if user is None or not verify_password(body.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account disabled",
        )
    return _issue_tokens(user)


@router.post("/refresh", response_model=TokenResponse)
async def refresh_tokens(
    body: RefreshRequest,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    try:
        payload = decode_token(body.refresh_token)
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        ) from exc

    if payload.get("token_type") != TOKEN_TYPE_REFRESH:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not a refresh token",
        )

    try:
        user_id = UUID(str(payload.get("sub")))
    except (TypeError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token subject",
        ) from exc

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User inactive or not found",
        )
    return _issue_tokens(user)
