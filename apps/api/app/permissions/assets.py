"""Asset visibility policy helpers (T9 MVP)."""
from __future__ import annotations

from sqlalchemy import ColumnElement, false, or_

from app.db.models.asset import Asset, PermissionScope
from app.db.models.user import User, UserRole


def can_read_asset(user: User, asset: Asset) -> bool:
    """Return whether ``user`` may read ``asset`` under current MVP policy."""
    if user.role == UserRole.admin:
        return True
    if asset.owner_id == user.id:
        return True
    return asset.permission_scope in {
        PermissionScope.family,
        PermissionScope.shared,
        PermissionScope.public_link,
    }


def asset_read_filter_for_user(user: User) -> ColumnElement[bool]:
    """SQLAlchemy filter for assets readable by ``user``."""
    if user.role == UserRole.admin:
        return true_expression()
    return or_(
        Asset.owner_id == user.id,
        Asset.permission_scope.in_(
            [
                PermissionScope.family,
                PermissionScope.shared,
                PermissionScope.public_link,
            ]
        ),
    )


def true_expression() -> ColumnElement[bool]:
    """Portable always-true SQL expression."""
    return ~false()
