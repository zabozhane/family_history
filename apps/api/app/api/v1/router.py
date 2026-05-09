"""Aggregate router for API version 1."""
from __future__ import annotations

from fastapi import APIRouter

from app.api.v1 import admin, assets, auth, timeline, users

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(admin.router, prefix="/admin", tags=["admin"])
api_router.include_router(assets.router, prefix="/assets", tags=["assets"])
api_router.include_router(timeline.router, prefix="/timeline", tags=["timeline"])
