# apps/api

FastAPI backend serving typed, versioned RESTful endpoints for the Family Media System.

## Responsibilities
- Define and manage core domain models (User, Asset, AssetVersion, TimelineEntry) via SQLAlchemy + Alembic.
- JWT + refresh-token authentication with role-based access control.
- Endpoints for media upload initiation, metadata retrieval, timeline aggregation.
- Permission system (private / family / shared / public-link).
- OpenAPI documentation.
- Strict typing and environment-based configuration.

## Status
Skeleton placeholder. Implementation lands incrementally per `TASKS.md` (starting with T2 — Dockerfile, T4 — DB schemas, T5 — auth).
