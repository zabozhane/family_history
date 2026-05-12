"""Aggregate router for API version 1."""
from __future__ import annotations

from fastapi import APIRouter

from app.api.v1 import admin, assets, auth, invitation_accept, timeline, users, workspace_sharing, workspaces

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(admin.router, prefix="/admin", tags=["admin"])
api_router.include_router(assets.router, prefix="/assets", tags=["assets"])
api_router.include_router(invitation_accept.router, prefix="/invitations", tags=["invitations"])
api_router.include_router(workspaces.router, prefix="/workspaces", tags=["workspaces"])
api_router.include_router(workspace_sharing.router, prefix="/workspaces", tags=["workspaces"])
api_router.include_router(timeline.router, prefix="/timeline", tags=["timeline"])
