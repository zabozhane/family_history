"""Timeline retrieval endpoints (T10 typed API surface)."""
from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.db.models.asset import Asset, AssetType
from app.db.models.asset_version import AssetVersion
from app.db.models.timeline_entry import TimelineEntry, TimelineEntryKind
from app.db.models.user import User, UserRole
from app.permissions.assets import asset_read_filter_for_user
from app.schemas.timeline import TimelineAssetRead, TimelineAssetVersionRead, TimelineItemRead

router = APIRouter()


@router.get("", response_model=list[TimelineItemRead])
async def list_timeline_entries(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    occurred_from: datetime | None = Query(default=None, alias="from"),
    occurred_to: datetime | None = Query(default=None, alias="to"),
    asset_type: AssetType | None = Query(default=None),
    kind: TimelineEntryKind | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[TimelineItemRead]:
    stmt = (
        select(TimelineEntry, Asset, AssetVersion)
        .outerjoin(Asset, TimelineEntry.asset_id == Asset.id)
        .outerjoin(
            AssetVersion,
            and_(
                AssetVersion.asset_id == TimelineEntry.asset_id,
                AssetVersion.is_primary.is_(True),
            ),
        )
        .order_by(TimelineEntry.occurred_at.desc())
        .limit(limit)
        .offset(offset)
    )
    if occurred_from is not None:
        stmt = stmt.where(TimelineEntry.occurred_at >= occurred_from)
    if occurred_to is not None:
        stmt = stmt.where(TimelineEntry.occurred_at <= occurred_to)
    if asset_type is not None:
        stmt = stmt.where(Asset.asset_type == asset_type)
    if kind is not None:
        stmt = stmt.where(TimelineEntry.kind == kind)
    if user.role != UserRole.admin:
        stmt = stmt.where(
            or_(
                TimelineEntry.user_id == user.id,
                and_(
                    TimelineEntry.asset_id.is_not(None),
                    asset_read_filter_for_user(user),
                ),
            )
        )
    result = await db.execute(stmt)
    items: list[TimelineItemRead] = []
    for entry, asset, primary_version in result.all():
        item = TimelineItemRead(
            id=entry.id,
            user_id=entry.user_id,
            asset_id=entry.asset_id,
            kind=entry.kind,
            occurred_at=entry.occurred_at,
            payload=entry.payload,
            asset=(
                TimelineAssetRead(
                    id=asset.id,
                    owner_id=asset.owner_id,
                    asset_type=asset.asset_type,
                    title=asset.title,
                    description=asset.description,
                    captured_at=asset.captured_at,
                    permission_scope=asset.permission_scope,
                )
                if asset is not None
                else None
            ),
            primary_version=(
                TimelineAssetVersionRead(
                    id=primary_version.id,
                    storage_key=primary_version.storage_key,
                    mime_type=primary_version.mime_type,
                    size_bytes=primary_version.size_bytes,
                    width=primary_version.width,
                    height=primary_version.height,
                    duration_ms=primary_version.duration_ms,
                )
                if primary_version is not None
                else None
            ),
        )
        items.append(item)
    return items
