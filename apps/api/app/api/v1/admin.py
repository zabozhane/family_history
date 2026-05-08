"""Routes demonstrating role-based access control (RBAC)."""
from __future__ import annotations

from fastapi import APIRouter, Depends

from app.api.deps import require_roles
from app.db.models.user import User, UserRole

router = APIRouter()


@router.get("/ping")
async def admin_ping(_admin: User = Depends(require_roles(UserRole.admin))) -> dict[str, str]:
    """Example endpoint restricted to ``admin`` role only."""
    _ = _admin
    return {"role": "admin", "status": "ok"}
