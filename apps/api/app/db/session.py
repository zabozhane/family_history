"""Async SQLAlchemy engine + session factory.

Used by FastAPI dependencies in T5+. Kept here so it has a stable import path
from day one — Alembic does NOT import this module (it builds its own engine
in ``migrations/env.py``).
"""
from __future__ import annotations

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import settings

engine: AsyncEngine = create_async_engine(
    settings.database_url_async,
    echo=False,
    pool_pre_ping=True,
    # Video/audio streaming used to pin sessions for the whole transfer;
    # routes are fixed to release early; keep modest headroom for bursts.
    pool_size=10,
    max_overflow=20,
)

AsyncSessionLocal: async_sessionmaker[AsyncSession] = async_sessionmaker(
    bind=engine,
    expire_on_commit=False,
    class_=AsyncSession,
)
