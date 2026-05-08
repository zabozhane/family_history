"""JWT creation + validation (HS256, python-jose)."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

from jose import JWTError, jwt

from app.core.config import settings

TOKEN_TYPE_ACCESS = "access"
TOKEN_TYPE_REFRESH = "refresh"


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def create_access_token(*, user_id: UUID, role_value: str) -> str:
    exp_ts = int(
        (_utcnow() + timedelta(seconds=settings.API_JWT_ACCESS_TTL_SECONDS)).timestamp()
    )
    payload: dict[str, Any] = {
        "sub": str(user_id),
        "role": role_value,
        "token_type": TOKEN_TYPE_ACCESS,
        "exp": exp_ts,
    }
    return jwt.encode(
        payload,
        settings.API_SECRET_KEY,
        algorithm=settings.API_JWT_ALGORITHM,
    )


def create_refresh_token(*, user_id: UUID) -> str:
    exp_ts = int(
        (_utcnow() + timedelta(seconds=settings.API_JWT_REFRESH_TTL_SECONDS)).timestamp()
    )
    payload: dict[str, Any] = {
        "sub": str(user_id),
        "token_type": TOKEN_TYPE_REFRESH,
        "exp": exp_ts,
    }
    return jwt.encode(
        payload,
        settings.API_SECRET_KEY,
        algorithm=settings.API_JWT_ALGORITHM,
    )


def decode_token(token: str) -> dict[str, Any]:
    """Decode and validate signature + ``exp``. Raises :class:`JWTError` on failure."""
    return jwt.decode(
        token,
        settings.API_SECRET_KEY,
        algorithms=[settings.API_JWT_ALGORITHM],
    )
