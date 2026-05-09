# Session Handoff

## Completed In This Session
**T9 — Permission system framework (private/family/shared/public_link) in API.**

- Added centralized policy module: `apps/api/app/permissions/assets.py`.
  - `can_read_asset(user, asset)` for object-level checks.
  - `asset_read_filter_for_user(user)` for SQL filtering.
- Extended upload endpoint:
  - `POST /api/v1/assets` now accepts `permission_scope` form field (default `private`).
- Added permission-aware read endpoints:
  - `GET /api/v1/assets` returns only visible assets.
  - `GET /api/v1/assets/{asset_id}` returns 404 for not found OR not visible (non-leaking).
- MVP scope policy:
  - `private` => owner/admin only.
  - `family/shared/public_link` => authenticated users (plus owner/admin).

## Test Summary
- `python3 -m compileall -q apps/api/app` — OK.
- `docker compose build api && docker compose up -d api` — OK.
- `docker compose exec api alembic upgrade head` — OK.
- E2E with 2 users and 2 assets:
  - user A uploads one `private` and one `family`,
  - user B `GET /api/v1/assets/{private_id}` => **404**,
  - user B `GET /api/v1/assets/{family_id}` => **200**,
  - user B `GET /api/v1/assets?limit=200` => only visible records.

## How To Test (repeatable)
1. Start API stack:
   `docker compose up -d postgres redis minio api`
2. Ensure schema:
   `docker compose exec api alembic upgrade head`
3. Register two users, upload assets with different `permission_scope`, then test:
   - `GET /api/v1/assets/{id}` as non-owner,
   - `GET /api/v1/assets?limit=200` as non-owner.

## Current Stack State
API rebuilt with T9 policy checks. Worker stack from T8 remains compatible.

## Known Issues / Risks
- `shared` vs `public_link` currently mapped to the same authenticated visibility in MVP; tokenized public-link sharing is not implemented yet.
- Policy currently guards asset read/list endpoints; additional future endpoints should reuse this module to avoid drift.

## Next Recommended Task
**T10 — Typed/versioned API surface completion (upload/timeline/permission endpoints in OpenAPI).**

## Notes For Next Session
- Read `CURSOR_EXECUTION_MODE.md` + `.ai/*.json` first.
- Keep T10 scoped to API contract completeness; avoid jumping into full UI work before planned tasks.
