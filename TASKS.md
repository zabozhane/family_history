# Implementation Tasks

## T1 — Establish modular project directory structure  [DONE]
Priority: High
Status: Done (session 1)

Create the base project repository structure with separate directories for apps/web/api/worker, including placeholder files to confirm setup.

Depends on:
- None

Completion note:
- Created `apps/{api,web,worker}`, `infrastructure/{docker,nginx,scripts}`, `packages/{shared-types,shared-utils}`.
- Added placeholder `README.md` (or `.gitkeep`) in every leaf directory describing its purpose and the task that will populate it.
- Added repo-root `.gitignore` (Python + Node + Docker volumes + env), `.editorconfig`, and `.env.example` template covering API/Postgres/Redis/MinIO/Web envs (used by T2–T7).

Tested:
- `find apps infrastructure packages -maxdepth 2 | sort` shows the exact expected layout.
- `ls -la` confirms `.gitignore`, `.editorconfig`, `.env.example` at repo root.

## T2 — Create Dockerfiles for api, web, and worker apps  [DONE]
Priority: High
Status: Done (session 2)

Develop Dockerfiles to containerize the api (FastAPI), web (Next.js), and worker (background jobs) components with appropriate base images and dependencies.

Depends on:
- T1

Completion note:
- `apps/api/Dockerfile`: `python:3.12-slim`, non-root `app` user, deps layer (`fastapi`, `uvicorn[standard]`, `pydantic`, `pydantic-settings`), HEALTHCHECK on `/health`, runs `uvicorn app.main:app`.
- `apps/worker/Dockerfile`: `python:3.12-slim` + `ffmpeg` (for T8), non-root user, deps layer (`dramatiq[redis]`), runs `dramatiq app.main`.
- `apps/web/Dockerfile`: multi-stage `node:20-alpine` (`deps → builder → runner`) using Next.js `output: 'standalone'`, non-root `nextjs` user, runs `node server.js`.
- Each app got the bare-minimum source for a successful build: `requirements.txt` / `package.json` / `tsconfig.json` / `next.config.mjs` and a tiny entrypoint (FastAPI `/health`, Dramatiq stub actor, Next.js home page).
- `.dockerignore` per app to keep build context small.

Tested:
- Static: Python AST parse on `apps/api/app/main.py` + `apps/worker/app/main.py` — OK.
- Static: JSON parse on `apps/web/package.json` + `apps/web/tsconfig.json` — OK.
- Dynamic (executed locally with Docker 29.4.2 / Compose v5.1.3):
  - `docker build -t fms-api    apps/api`     → image `fms-api:latest` (293MB).
  - `docker build -t fms-worker apps/worker`  → image `fms-worker:latest` (810MB; ffmpeg dominates).
  - `docker build -t fms-web    apps/web`     → image `fms-web:latest` (273MB; Next.js standalone).
  - `docker run --rm -d --name fms-api-smoke -p 8000:8000 fms-api`
    → `curl http://localhost:8000/health` ⇒ `{"status":"ok"}` (~2s)
    → `curl http://localhost:8000/`        ⇒ `{"service":"family-media-api","version":"0.1.0","docs":"/docs"}`
  - `docker run --rm -d --name fms-web-smoke -p 3000:3000 fms-web`
    → `curl http://localhost:3000/` ⇒ HTTP 200 with `<title>Family Media System</title>`
  - `docker run --rm fms-worker python -c "from app import main"` ⇒ broker = `RedisBroker` (full run deferred to T3 once Redis is up).

## T3 — Set up docker-compose with PostgreSQL, Redis, and MinIO  [DONE]
Priority: High
Status: Done (session 3)

Configure docker-compose to orchestrate containers for PostgreSQL database, Redis cache/queue, MinIO S3-compatible storage, and the three app containers (api, web, worker).

Depends on:
- T1
- T2

Completion note:
- `docker-compose.yml` at repo root with seven services: `postgres` (16-alpine), `redis` (7-alpine, AOF on), `minio` (latest, console on :9001), `minio-init` (one-shot `mc` job creating the `family-media` bucket), `api`, `worker`, `web`.
- Healthchecks: postgres (`pg_isready`), redis (`redis-cli ping`), minio (HTTP `/minio/health/ready`). API and worker `depends_on` infra services with `condition: service_healthy`; `web` waits for `api` healthy.
- Persistent named volumes: `postgres_data`, `redis_data`, `minio_data`. Dedicated bridge network `fms`.
- Env wired through `.env` (auto-loaded by Compose). Local `.env` bootstrapped from `.env.example` (gitignored).
- Bucket bootstrap: `minio-init` aliases MinIO and runs `mc mb --ignore-existing fms/$S3_BUCKET`, exits cleanly.
- `README.md` got a Quick Start section with all service URLs and creds.

Tested:
- `docker compose config -q` ⇒ OK.
- `docker compose up -d` ⇒ all containers `healthy` (api healthcheck `Up (healthy)`, postgres/redis/minio healthy).
- `curl http://localhost:8000/health` ⇒ `{"status":"ok"}`.
- `curl http://localhost:8000/`        ⇒ `{"service":"family-media-api","version":"0.1.0","docs":"/docs"}`.
- `curl http://localhost:3000/`         ⇒ HTTP 200 (Next.js standalone serving home page).
- `curl http://localhost:9000/minio/health/ready` ⇒ HTTP 200.
- `curl http://localhost:9001/`         ⇒ HTTP 200 (MinIO console).
- `docker exec fms-redis redis-cli ping` ⇒ `PONG`.
- `docker exec fms-postgres pg_isready -U family -d family_media` ⇒ `accepting connections`.
- `mc ls fms` (via one-shot mc container on the `family-media_fms` network) ⇒ shows bucket `family-media/`.
- `docker compose logs minio-init` ⇒ `Bucket created successfully` + `[minio-init] bucket 'family-media' ready`.
- `docker compose logs worker` ⇒ Dramatiq 1.18.0 booted, `Worker process is ready for action`.

## T4 — Implement core database schemas with SQLAlchemy and Alembic migrations  [DONE]
Priority: High
Status: Done (session 4)

Define core domain models User, Asset, AssetVersion, TimelineEntry in SQLAlchemy and create Alembic migrations to set up initial tables in PostgreSQL.

Depends on:
- T3

Completion note:
- Added SQLAlchemy 2.x async + asyncpg + Alembic to `apps/api/requirements.txt`.
- New modules in `apps/api/app/`:
  - `core/config.py` — pydantic-settings reading `POSTGRES_*` and exposing `database_url_async`.
  - `db/base.py` — `Base` (DeclarativeBase) + `UUIDPKMixin` (UUID v4 default) + `TimestampMixin` (server-side `created_at`/`updated_at`).
  - `db/session.py` — async engine + sessionmaker (used by routes from T5+; not imported by Alembic).
  - `db/models/{user,asset,asset_version,timeline_entry}.py` plus `__init__.py` registry.
- Models capture the spec exactly:
  - `User`: email (unique), hashed_password, display_name, role enum (admin/family/child/guest), is_active.
  - `Asset`: owner FK→users (CASCADE), asset_type enum (image/video/audio/note/document/voice_note/link/archive), title, description, captured_at (indexed), permission_scope enum (private/family/shared/public_link).
  - `AssetVersion`: asset FK→assets (CASCADE), storage_key, mime_type, size_bytes (BigInteger), width/height/duration_ms, is_primary, JSONB metadata.
  - `TimelineEntry`: user FK→users (CASCADE), asset FK→assets nullable (CASCADE), kind enum (asset_added/event/activity), occurred_at (indexed), JSONB payload.
- Alembic configured inside `apps/api/`:
  - `alembic.ini` (script_location = migrations, URL injected at runtime).
  - `migrations/env.py` — async-aware, builds engine from `app.core.config.settings.database_url_async`, registers models via `import app.db.models`.
  - `migrations/script.py.mako` — project template.
- Initial revision `216b02aa5afa_initial_schema.py` created via autogenerate; downgrade extended with `DROP TYPE IF EXISTS …` to keep round-trips clean.
- `apps/api/Dockerfile` updated to `COPY alembic.ini` + `COPY migrations` so migrations ship with the image.

Tested:
- `python3 -m ast` parse on every new module — OK.
- `docker compose build api` — succeeds with new deps (alembic 1.18.4, sqlalchemy 2.0.49, asyncpg 0.31.0).
- `docker compose run --rm -v ./apps/api/migrations:/app/migrations api alembic revision --autogenerate -m "initial schema"` — generated `216b02aa5afa_initial_schema.py` (4 tables, 4 enums, 9 indexes).
- `docker compose exec api alembic upgrade head` — applied; `alembic current` ⇒ `216b02aa5afa (head)`.
- `\dt` ⇒ `users`, `assets`, `asset_versions`, `timeline_entries`, `alembic_version`.
- `\dT+` ⇒ enums `user_role`, `asset_type`, `permission_scope`, `timeline_entry_kind` with the exact value sets from spec.
- `\d` for each table ⇒ FKs CASCADE, indexes (`ix_users_email` UNIQUE, `ix_assets_owner_id`, `ix_assets_captured_at`, `ix_assets_asset_type`, `ix_asset_versions_asset_id`, `ix_timeline_entries_{user_id,asset_id,kind,occurred_at}`), defaults (`is_active=true`, `permission_scope='private'`, JSONB `'{}'`).
- Round-trip `alembic downgrade base` ⇒ only `alembic_version` left, all enum types removed; subsequent `alembic upgrade head` re-creates everything cleanly.

## T5 — Implement JWT authentication with user roles in FastAPI backend  [DONE]
Priority: High
Status: Done (session 5)

Develop JWT-based authentication with refresh tokens, including user roles (admin, family member, child, guest) and role-based access control middleware for API endpoints.

Depends on:
- T4

Completion note:
- Dependencies: `email-validator`, `bcrypt`, `python-jose[cryptography]` (native `bcrypt` instead of passlib — avoids bcrypt 4.x backend detection crash in slim images).
- `app/core/config.py`: `database_url_async` now URL-encodes Postgres user/password via `urllib.parse.quote_plus`.
- `app/security/password.py`: bcrypt hash + verify.
- `app/security/tokens.py`: HS256 access + refresh JWTs; claims `sub`, `token_type` (`access`/`refresh`), `role` on access tokens; `exp` as unix timestamp.
- `app/api/deps.py`: async `get_db`, `get_current_user` (Bearer), `require_roles(*UserRole)` — **RBAC reads live `users.role` from DB**, JWT `role` claim ignored on purpose so promotions/demotions apply immediately.
- Routes under `/api/v1`: `POST /auth/register` (always creates `family` role), `POST /auth/login`, `POST /auth/refresh`, `GET /users/me`, `GET /admin/ping` (admin-only demo).
- Pydantic schemas: `app/schemas/auth.py`, `app/schemas/user.py`.
- `app/main.py`: mounts `api_router` at `/api/v1`.

Tested:
- After fresh volumes: `docker compose exec api alembic upgrade head` → schema present (`216b02aa5afa`).
- `docker compose build api && docker compose up -d api`.
- OpenAPI lists `/api/v1/auth/register`, `/api/v1/auth/login`, `/api/v1/auth/refresh`, `/api/v1/users/me`, `/api/v1/admin/ping`.
- E2E curl flow: register → `/users/me` → `/admin/ping` 403 as family → `UPDATE users SET role='admin'` → same access JWT → `/admin/ping` **200** (DB-backed RBAC) → demote to family → **403** → refresh after re-promote → **200** on `/admin/ping`.
- Duplicate email register → **409**; wrong password → **401**.

## T12a — Minimal login/register UI (out-of-order, dev-only)  [DONE]
Priority: Medium (out-of-order; will be SUPERSEDED by T12)
Status: Done (session 5b)

Add a minimal, dev-only auth UI in `apps/web` so the project can be reached through the browser before the full T12 (Tailwind + shadcn/ui) ships. Tracked separately so T12 keeps its proper, opinionated rebuild.

Depends on:
- T5

Completion note:
- API: `app/main.py` adds `CORSMiddleware`; `app/core/config.py` exposes `CORS_ALLOWED_ORIGINS` (default `["http://localhost:3000"]`).
- Web Dockerfile: `ARG`/`ENV NEXT_PUBLIC_API_BASE_URL` baked into the Next.js bundle at build stage.
- `docker-compose.yml`: `web.build.args.NEXT_PUBLIC_API_BASE_URL` honors the same env value.
- `apps/web/lib/{types,auth,api,styles}.ts`: typed `apiFetch<T>` with one silent refresh on 401, localStorage tokens, inline-style atoms.
- Pages: `app/login/page.tsx`, `app/register/page.tsx`, `app/me/page.tsx`, updated `app/page.tsx` with anonymous landing links.
- ~~Every UI file carried `// TODO(T12)` markers~~ — superseded by **T12** (markers removed from `apps/web`).

Tested:
- `docker compose build api web` + `docker compose up -d` — both healthy.
- CORS: preflight from `http://localhost:3000` returns `access-control-allow-origin: http://localhost:3000`; preflight from `http://evil.example` returns 400 (no allow-origin).
- `localhost:8000` is baked into `/app/.next/server/app/{login,register,me}/page.js`.
- E2E with `Origin: http://localhost:3000`: register → access token; `GET /users/me` → user JSON; login → tokens; bad token → 401 (triggers `tryRefresh()`); refresh → new token pair.
- `/login` renders with `<title>Family Media System</title>`.

Open questions to revisit in T12 proper:
- Replace inline styles with shadcn/ui (Form, Input, Button) + Tailwind.
- Token storage strategy: localStorage vs httpOnly cookies (XSS trade-off).
- Re-issue server-side refresh-rotation / revocation list.
- Generate TS types from OpenAPI instead of hand-mirroring.

## T6 — Create upload pipeline skeleton for media assets  [DONE]
Priority: Medium
Status: Done (session 6)

Implement API endpoints to accept image/audio/video uploads, save files in MinIO storage, store metadata placeholder in database, and create Asset and AssetVersion records.

Depends on:
- T5

Completion note:
- `apps/api/requirements.txt`: `aioboto3`, `python-multipart`.
- `app/core/config.py`: `S3_*` settings aligned with Compose / `.env.example`, plus `API_UPLOAD_MAX_BYTES` (default ~100MB).
- `app/storage/s3.py`: async `put_object` via aioboto3 + path-style addressing for MinIO.
- `app/schemas/asset.py`: `AssetRead`, `AssetVersionRead`, `AssetUploadResponse`.
- `app/api/v1/assets.py`: `POST /api/v1/assets` — multipart `file`, optional `title`/`description`/`captured_at` (ISO 8601); MIME→`AssetType` for `image/*`, `video/*`, `audio/*` only (**415** otherwise); storage key `{owner_id}/{asset_id}/{version_id}{suffix}`; `permission_scope` default **private**; `flush` → MinIO `put_object` → `commit`, rollback DB on storage failure (**502**).
- `app/api/v1/router.py`: mounts assets router at `/assets`.
- `.env.example`: commented hint for optional `API_UPLOAD_MAX_BYTES`.
- **Out of scope (by plan):** Dramatiq enqueue (T7), metadata extraction (T8).

Tested:
- `python3 -m compileall -q apps/api/app` — OK.
- `docker compose build api && docker compose up -d api` — OK.
- OpenAPI (`/docs`): `POST /api/v1/assets` under tag **assets**.
- Register → `POST /api/v1/assets` with tiny PNG (`Content-Type: image/png`) → **201**; JSON returns nested `asset` + `version` with `storage_key`, `mime_type`, `size_bytes`, empty `media_metadata`, null width/height/duration.
- Bogus Bearer token on upload → **401**.
- `text/plain` upload → **415**.

## T7 — Set up Dramatiq task queue using Redis broker  [DONE]
Priority: Medium
Status: Done (session 7)

Integrate Dramatiq with Redis for async task processing in worker app and connect worker to API for enqueuing media metadata extraction jobs.

Depends on:
- T3
- T5

Completion note:
- `apps/api/requirements.txt`: `dramatiq[redis]` (producer).
- `app/core/config.py`: `REDIS_HOST` / `REDIS_PORT` / `REDIS_DB` + `redis_url` for `RedisBroker`.
- `app/dramatiq_broker.py`: API process sets global Dramatiq broker (matches Compose `REDIS_*` env already passed to `api`).
- `app/tasks_media.py` (API): declares `extract_asset_version_metadata` with explicit `actor_name` + `queue_name="media"` for stable cross-process routing.
- `apps/worker/app/tasks_media.py`: consumer stub — logs `asset_version_id`; T8 replaces body with real extraction + DB writes.
- `apps/worker/app/main.py`: imports `tasks_media` after broker init so Dramatiq registers the actor.
- `app/main.py`: imports `dramatiq_broker` + `tasks_media` **before** `api_router` so actors exist before route modules load.
- `app/api/v1/assets.py`: after successful DB commit on upload, `extract_asset_version_metadata.send(str(version.id))`; enqueue failures are logged and do **not** fail the HTTP response (upload already persisted).

Tested:
- `python3 -m compileall -q apps/api/app apps/worker/app` — OK.
- `docker compose build api worker && docker compose up -d api worker` — OK.
- Register → `POST /api/v1/assets` (tiny PNG) → **201**; `docker compose logs worker` shows `[worker] extract_asset_version_metadata (stub): asset_version_id=<uuid>`.

## T8 — Implement media metadata extraction background jobs  [DONE]
Priority: Medium
Status: Done (session 8)

Develop worker tasks to fetch uploaded media from MinIO, extract metadata using ffmpeg, Pillow, mutagen, and update AssetVersion metadata in the database.

Depends on:
- T6
- T7

Completion note:
- `apps/worker/requirements.txt`: added `pydantic`, `pydantic-settings`, `aioboto3`, `asyncpg`, `Pillow`, `mutagen`.
- `apps/worker/app/core/config.py`: env-based worker settings (`REDIS_*`, `POSTGRES_*`, `S3_*`) with `redis_url` + `postgres_dsn`.
- `apps/worker/app/main.py`: broker now uses `settings.redis_url`.
- `apps/worker/app/media_processing.py`: extraction helpers:
  - image: Pillow (`width`, `height`, format/mode),
  - audio: mutagen (+ ffprobe fallback for duration),
  - video: ffprobe (`width`, `height`, `duration_ms`).
- `apps/worker/app/tasks_media.py`: real actor implementation for `extract_asset_version_metadata`:
  - reads `storage_key`/`mime_type` from `asset_versions`,
  - downloads object from MinIO,
  - extracts metadata by MIME,
  - updates `width`/`height`/`duration_ms`/`metadata` in Postgres.

Tested:
- `python3 -m compileall -q apps/worker/app` — OK.
- `docker compose build worker && docker compose up -d postgres redis minio api worker` — OK.
- `docker compose exec api alembic upgrade head` — OK.
- E2E: register + upload tiny PNG → worker log contains `extracted metadata` entry with the uploaded `version_id`.
- DB check for uploaded `version_id`: `width=1`, `height=1`, `duration_ms=null`, and populated `metadata` JSON.

## T9 — Develop permission system for private, family, shared scopes  [DONE]
Priority: Medium
Status: Done (session 9)

Implement framework in API backend to check and enforce asset permissions based on scopes for users across all relevant endpoints.

Depends on:
- T5

Completion note:
- Added `apps/api/app/permissions/assets.py` with centralized visibility policy:
  - `can_read_asset(user, asset)` for per-record checks,
  - `asset_read_filter_for_user(user)` for SQL-level filtering.
- Updated `POST /api/v1/assets` to accept `permission_scope` (defaults to `private`).
- Added read endpoints in `apps/api/app/api/v1/assets.py`:
  - `GET /api/v1/assets` (paginated list of visible assets),
  - `GET /api/v1/assets/{asset_id}` (404 when missing or not visible).
- Policy behavior in MVP:
  - `private` => owner/admin only,
  - `family`/`shared`/`public_link` => visible to authenticated users (plus owner/admin).

Tested:
- `python3 -m compileall -q apps/api/app` — OK.
- `docker compose build api && docker compose up -d api` — OK.
- `docker compose exec api alembic upgrade head` — OK.
- E2E with 2 users:
  - user A uploads one `private` and one `family` asset,
  - user B `GET /assets/{private}` => **404**,
  - user B `GET /assets/{family}` => **200**,
  - user B `GET /assets?limit=200` includes only visible items.

## T10 — Build typed, versioned FastAPI RESTful API with OpenAPI docs  [DONE]
Priority: High
Status: Done (session 10)

Define typed API endpoints for authentication, media upload, timeline retrieval, permission checks, and document API versions with OpenAPI specification.

Depends on:
- T5
- T6
- T9

Completion note:
- Added typed timeline schemas in `apps/api/app/schemas/timeline.py`.
- Added timeline endpoint `GET /api/v1/timeline` in `apps/api/app/api/v1/timeline.py` and mounted router in `api/v1/router.py`.
- Extended assets API with typed permission-check endpoint:
  - `GET /api/v1/assets/{asset_id}/permission`.
- Extended upload contract:
  - `POST /api/v1/assets` now supports `permission_scope` in multipart form (default `private`).
- Added automatic timeline event creation on upload:
  - each upload creates `TimelineEntry(kind=asset_added)` with typed payload.
- OpenAPI `/docs` now includes typed routes for auth, assets (upload/list/get/permission), users/me, admin ping, and timeline retrieval under `/api/v1`.

Tested:
- `python3 -m compileall -q apps/api/app` — OK.
- `docker compose build api && docker compose up -d api` — OK.
- `docker compose exec api alembic upgrade head` — OK.
- E2E:
  - upload `family` asset => `GET /api/v1/assets/{id}` as second user => **200**,
  - `GET /api/v1/assets/{id}/permission` => **200** with typed keys,
  - `GET /api/v1/timeline?limit=20` => **200** and includes uploaded `asset_id`.

## T11 — Implement foundational timeline aggregation model  [DONE]
Priority: Medium
Status: Done (session 11)

Develop backend logic to aggregate Assets, AssetVersions, and TimelineEntries into a unified timeline view respecting permissions and filter criteria.

Depends on:
- T4
- T9

Completion note:
- Reworked `GET /api/v1/timeline` into an aggregated timeline endpoint:
  - joins `timeline_entries` with related `assets` and primary `asset_versions`.
- Added typed aggregation schemas in `apps/api/app/schemas/timeline.py`:
  - `TimelineItemRead`, `TimelineAssetRead`, `TimelineAssetVersionRead`.
- Added permission-aware and filterable retrieval in `apps/api/app/api/v1/timeline.py`:
  - filters: `from`, `to`, `asset_type`, `kind`, `limit`, `offset`.
  - non-admin visibility combines own entries + readable asset-linked entries.
- Timeline response now includes, per item:
  - base entry fields,
  - optional embedded `asset`,
  - optional embedded `primary_version`.

Tested:
- `python3 -m compileall -q apps/api/app` — OK.
- `docker compose build api && docker compose up -d api` — OK.
- `docker compose exec api alembic upgrade head` — OK.
- E2E:
  - upload `family` image asset,
  - `GET /api/v1/timeline?asset_type=image&kind=asset_added&limit=20` => **200**,
  - response items contain `asset` and `primary_version` objects and include uploaded `asset_id`.

## T12 — Create Next.js frontend shell with authentication integration  [DONE]
Priority: High
Status: Done

Implement frontend authentication flows using JWT tokens from API, including login, logout, and protected routes with Tailwind and shadcn/ui components.

Depends on:
- T10

Note: This task SUPERSEDES T12a — rebuild the auth screens on Tailwind + shadcn/ui, revisit token storage strategy (localStorage → httpOnly cookies), and remove all `// TODO(T12)` markers in `apps/web`.

Completion note:
- Tailwind + PostCSS + `tailwindcss-animate`; minimal shadcn-style primitives in `components/ui/` (`Button`, `Input`, `Label`, `Card`) and `app/globals.css`.
- JWTs stored in **httpOnly** cookies only (`fms_access`, `fms_refresh`). Route handlers: `/api/session/login`, `/api/session/register`, `/api/session/logout`; BFF proxy `/api/fms/[...path]` forwards to FastAPI and performs server-side refresh when upstream returns 401.
- `middleware.ts` redirects unauthenticated visits away from `/me` to `/login`.
- `API_INTERNAL_BASE_URL` (default `http://api:8000` in Compose) for server-side fetches from the `web` container; browsers continue using `NEXT_PUBLIC_API_BASE_URL` for same-origin `/api/*`.
- Removed `lib/styles.ts`; cleared all `// TODO(T12)` markers under `apps/web`.

Tested:
- `npm install && npm run build` in `apps/web` — OK.

## T13 — Implement basic photo gallery and music playback  [DONE]
Priority: Medium
Status: Done

Develop UI components for browsing photo gallery and playing music tracks with basic playback controls consuming API data.

Depends on:
- T12
- T10

Completion note:
- **API**: `AssetRead` now includes optional `primary_version`; `GET /api/v1/assets` and `GET /api/v1/assets/{id}` eager-load versions. New **`GET /api/v1/assets/{asset_id}/file`** streams the primary version from MinIO/S3 (`iter_object_chunks`, `head_object_exists` in `app/storage/s3.py`) with permission checks.
- **Web**: `SiteNav` in root layout; protected routes **`/gallery`** and **`/music`** (middleware). Pages load assets via `apiFetch`, filter by `asset_type`, render images from `/api/fms/v1/assets/{id}/file` and HTML5 `<audio controls>`. Types in `lib/types.ts`, helper `lib/media-url.ts`.

Tested:
- Python AST parse on touched API files — OK.
- `npm run build` in `apps/web` — OK.

## T14 — Implement timeline navigation and filtering UI  [DONE]
Priority: Medium
Status: Done

Develop frontend timeline view with filtering by time ranges and asset types, integrating API timeline endpoints and updating UI accordingly.

Depends on:
- T12
- T11

Completion note:
- **`/timeline`**: client page with filters mapped to `GET /api/v1/timeline` (`from`/`to` as ISO datetimes from `datetime-local`, `asset_type`, `kind`), Apply / Reset, and **Load more** pagination (`offset`/`limit`).
- Cards show kind badge, `occurred_at`, linked asset title/type/scope, payload summary for uploads, optional **image thumbnail** via `assetFileUrl` when `asset_type === image`.
- Types: `TimelineItemRead` and related in `lib/types.ts`; query helper `lib/timeline-query.ts`.
- **Middleware** + **SiteNav** + home CTA include `/timeline` (auth-gated like gallery/music).

Tested:
- `npm run build` in `apps/web` — OK.

## T15 — Implement environment configuration and strict typing across codebase  [DONE]
Priority: Medium
Status: Done

Ensure all components (api, web, worker) use environment variables for config and enforce TypeScript/Python strict typing for code quality.

Depends on:
- T1

Completion note:
- **Web**: `tsconfig.json` adds `noUncheckedIndexedAccess`, `noImplicitOverride`, `noUnusedLocals`, `noUnusedParameters`; server env accessors live in **`lib/env/server.ts`** (used via `lib/server/backend-url.ts`).
- **API**: `Settings` loads optional **`.env`** via pydantic-settings; **`reject_weak_secret_in_production`** validator blocks default/short secrets when `API_ENV=production`. ORM-facing schemas use **`model_config: ClassVar[ConfigDict]`** for Pyright-friendly Pydantic v2 typing.
- **Worker**: same **`.env`** file hook on `Settings`; **`apps/worker/pyproject.toml`** + **`requirements-dev.txt`** for Pyright.
- **Tooling**: **`apps/api/pyproject.toml`**, **`apps/api/requirements-dev.txt`**, worker counterparts; **`.env.example`** documents web internal URL + worker/pyright usage.

Tested:
- `npm run build` and `npm run typecheck` in `apps/web` — OK.
- Python AST parse on touched API/worker modules — OK.

## T16 — Dashboard shell: sidebar layout and navigation  [DONE]
Priority: High
Status: Done

Implement the persistent **left sidebar** from the wireframe: project title/branding, primary nav (**Timeline**, **Photos**, **Music**), and **Logout** at the bottom. Define how clicks behave: e.g. **Timeline** scrolls/focuses the main timeline strip on the **home dashboard** (or navigates to `/` with that region), **Photos** opens the dedicated photos view (existing `/gallery` or renamed route) with list + future upload affordance, **Music** either anchors the player or opens a fuller tracks view as needed. Unauthenticated users keep current marketing/home behavior; authenticated layout uses the shell.

Depends on:
- T12
- T13

Completion note:
- **`DashboardShell`** (`components/dashboard-shell.tsx`): left column **Family Media** header (link home), nav **Timeline** → `/#dashboard-timeline`, **Photos** → `/gallery`, **Music** → `/music`, **Profile** → `/me`, footer **`SignOutButton`** with label **Log out**.
- **Route group** `app/(dashboard)/layout.tsx` wraps **`/gallery`**, **`/music`**, **`/timeline`**, **`/me`** with the same shell (URLs unchanged). Root **`SiteNav`** removed from `app/layout.tsx`; file **`site-nav.tsx`** deleted.
- **Authenticated `/`**: server branch renders **`DashboardShell`** + placeholder **`#dashboard-timeline`** section (links to full **`/timeline`** until **T17**). Guests keep centered marketing + Sign in / Create account only.
- **Login / register** success redirects to **`/`** (dashboard home) instead of **`/me`**, using **`window.location.assign("/")`** so the server render sees new httpOnly cookies (SPA **`router.push`** alone could reuse stale RSC for **`/`**).
- **`/`** **`export const dynamic = "force-dynamic"`** so the home tree is not cached without fresh **`cookies()`**.
- **Session cookies** (`lib/server/session-cookies.ts`): **`Secure`** only when the incoming request is HTTPS (**`x-forwarded-proto`** / **`req.nextUrl.protocol`**). Compose runs **`web`** with **`NODE_ENV=production`** on plain **`http://localhost:3000`**; unconditional **`Secure`** previously prevented browsers from storing **`fms_access`**. Login/register/logout + BFF refresh proxy pass **`NextRequest`** into **`applyAuthCookies`** / **`clearAuthCookies`**.
- **`SignOutButton`**: optional **`label`** prop for sidebar wording.

Tested:
- `npm run typecheck` && `npm run build` in `apps/web` — OK (after clearing stale `.next` cache).
- Manual Docker: **`docker compose build web && docker compose up -d web`** — login shows dashboard **`/`** with sidebar.

## T17 — Home dashboard: time-range strip, filtered photos, bottom player  [DONE]
Priority: High
Status: Done

On the **main dashboard** (post-login home), stack three vertical zones: (1) **interactive time axis** (e.g. month buckets or draggable range) that sets a **`from`/`to`** filter; (2) **photo grid** for **image** assets whose `captured_at` (or agreed field) falls in that interval, using existing APIs/BFF patterns (`GET /api/v1/assets` with client-side filter or query params if/when API supports them); (3) **compact music player** for **audio** assets: play/pause, prev/next track, wired to streamed files via `/api/fms/v1/assets/{id}/file`. Reuse types/helpers from gallery/music/timeline where possible.

Depends on:
- T16
- T13
- T14

Completion note:
- **`DashboardHome`** (`components/dashboard-home.tsx`): client component on **`/`** inside **`DashboardShell`**. Loads **`GET /api/v1/assets?limit=200`** once; filters **images** / **audio** by **`captured_at`** falling in the **selected calendar month (local timezone)**.
- **Timeline strip**: superseded by **T19** — year row + **12-month bar** (was: **last 36** month pills).
- **Photos**: responsive grid + **`assetFileUrl`** thumbnails; empty copy explains **`captured_at`** requirement + link **`/gallery`**.
- **Player**: footer bar with **Previous / Play / Next**, **`audio`** with **`assetFileUrl`**, **`onEnded`** advances (wrap); **playlist order** labeled as **`captured_at` descending**; empty state + link **`/music`**.
- **`DashboardShell`** main column **`overflow-hidden` / `min-h-0`** so mid pane scrolls under fixed-ish footer player.

Tested:
- `npm run typecheck` && `npm run build` in `apps/web` — OK.

## T19 — Dashboard timeline: year row + month bar (single month)  [DONE]
Priority: Medium
Status: Done

Replace the **rolling month pills** on the authenticated home timeline with a **year selector** (top row) and a **continuous horizontal month bar** for the selected year: **12 segments**, one **calendar month** each (local timezone). Selecting a segment filters photos and the dashboard player the same way as **T17** ( **`captured_at`** within that month). Multi-month ranges deferred.

Depends on:
- T17

Completion note:
- **`DashboardHome`**: **`selectedYear`** + **`selectedMonthIndex`**; month selection UX refined in **T20** (years from data + chevron months).
- Sidebar **Timeline** anchor **`#dashboard-timeline`** unchanged.

Tested:
- `npm run typecheck` && `npm run build` in `apps/web` — OK.

## T20 — Dashboard timeline: data-driven years + chevron months with emoji  [DONE]
Priority: Medium
Status: Done

Limit the **year** row to calendar years that appear on at least one asset’s **`captured_at`** (from the dashboard asset fetch). If nothing has a capture date, show **only the current year** and helper copy. Replace the flat **12-month row** with **interlocking chevron** segments (breadcrumb-style **`clip-path`**): each segment shows **localized full month name** + **seasonal emoji** (winter snow / spring sprout / summer sun / autumn leaves); gradients follow season. Filtering behavior unchanged (**T17**/**T19**).

Depends on:
- T19

Completion note:
- **`yearsFromAssets`**: unique years from **`parseCapturedAt`** over all returned assets; **`yearOptions`** defaults **`[currentYear]`** when empty.
- **Chevron strip**: **`CHEVRON_NOTCH_PX`** overlap; **`monthEmoji`** map per month index; **`Intl`** **`month: "long"`**; horizontal scroll **`min-w-[640px]`** on narrow viewports.

Tested:
- `npm run typecheck` && `npm run build` in `apps/web` — OK.

## T18 — Photos page: browsing + upload new media  [DONE]
Priority: Medium
Status: Done

Dedicated **Photos** experience: grid/list of images as today plus **upload** via multipart **`POST /api/v1/assets`** (through BFF with cookie auth). Simple form: file input(s), optional title/description/captured date if API accepts them; success refreshes list and surfaces errors. Keep scope to images first unless API already treats audio uniformly.

Depends on:
- T16
- T10

Completion note:
- **`GalleryUploadForm`** (`components/gallery-upload-form.tsx`): multipart **`apiUploadAsset`** → **`/api/fms/v1/assets`** (`credentials: include`); **`file`** + **`permission_scope`** only (title/description/capture date dropped per UX — **`T21`**).
- **`lib/api.ts`**: **`apiUploadAsset`**, shared **`formatApiDetail`** for FastAPI string/array **`detail`**; **`apiFetch`** errors use same formatter.
- **`lib/types.ts`**: **`AssetUploadResponse`**.
- **`/gallery`**: upload card above grid; **`reloadAssets({ silent: true })`** after upload (silent refresh failures keep existing grid).

Completion criteria (DoD):
- User can add at least one new image from the Photos route and see it in the list after upload.
- Errors from API are shown inline or via toast pattern consistent with the app.

Tested:
- `npm run typecheck` && `npm run build` in `apps/web` — OK.
- Manual: Compose stack — upload image on **`/gallery`**, grid refreshes.

## T21 — Fix asset list `primary_version` (gallery thumbnails)  [DONE]
Priority: Medium
Status: Done

**`GET /api/v1/assets`** sometimes returned **`primary_version: null`** while rows existed in **`asset_versions`**, so the web gallery showed **No file** / **Untitled** thumbnails. Root fix: load **`Asset`** rows and **`AssetVersion`** rows in two queries, bucket by **`asset_id`**, and pass **`version_rows`** into **`serialize_asset_read`**; **`GET …/{id}`** / file stream use **`set_committed_value`** on **`versions`** after explicit **`AssetVersion`** query.

Depends on:
- T10

Completion note:
- **`apps/api/app/api/v1/assets.py`**: removed **`selectinload`** list path; **`_pick_primary_version_from_rows`**; **`serialize_asset_read(..., version_rows=...)`**.

Tested:
- Python AST parse **`assets.py`** — OK; **`npm run build`** (**`apps/web`**) — OK.

## T22 — Music library: Spotify-style player, multi-upload, delete, filename titles  [DONE]
Priority: Medium
Status: Done

Deliver a full **`/music`** experience: compact upload of multiple audio files, bottom player styled like Spotify (transport, scrubbable progress, volume, shuffle/repeat), list rows with icon play/pause and delete with confirmation; **`DELETE /api/v1/assets/{id}`** for owners/admins; default **`Asset.title`** from uploaded filename when the multipart **`title`** field is omitted.

Depends on:
- T13 (basic music playback)
- T21 (asset list / file routes stable)

Completion note:
- **`apps/web`**: **`music-upload-form.tsx`** — compact toolbar (no large card), **`multiple`** file input, sequential **`POST /api/v1/assets`** per file; **`music-player-bar.tsx`** — dark pill UI (**`lucide-react`** icons), hidden native `<audio controls>` replaced by custom scrubber + volume; **`music/page.tsx`** — footer player, shuffle/next randomization when shuffle on, repeat one/all/off, Russian delete confirm modal, row **Play/Pause** + **Trash** icons.
- **Follow-up (player + dashboard + list UX)**: **`MusicPlayerProvider`** in root **`app/layout.tsx`** (single `<audio>`, playback continues across routes e.g. Music → home/Timeline). **`music-player-context.tsx`**: dock **`fixed`** under main column (`left-[220px]`), bar passes **`durationMsFallback`** from **`primary_version.duration_ms`**, `<audio>` rendered before **`{children}`**; compact **`music-player-bar`**. **`dashboard-shell.tsx`**: **`h-dvh`** + **`overflow-hidden`**, inner pane scroll only; bottom padding when dock visible. **`music/page.tsx`**: denser track rows (`py-2`, smaller buttons/text).
- **Follow-up (gallery + timeline + player queue)**: **`gallery-lightbox.tsx`**, компактный **`gallery-upload-form`** без выбора visibility (default private); **`gallery/page.tsx`** — лайтбокс, удаление, плотная сетка. **`dashboard-home.tsx`** — узкая полоска месяцев, фильтры Photo/Video/Music/All, видео в месяце, лайтбокс по превью, список музыки месяца без авто-**`replaceQueue`** при смене месяца; **`loadQueueAndPlay`** в **`music-player-context`**. Убран встроенный footer player с главной.
- **`apps/web/lib/api.ts`**: **`apiDeleteAsset`** (`DELETE` via BFF).
- **`apps/api`**: **`DELETE /api/v1/assets/{id}`** — delete MinIO keys then **`Asset`** row; **`delete_object`** in **`storage/s3.py`**; **`_resolved_asset_title`** — if **`title`** Form empty, use **`PurePosixPath(filename).stem`** (applies to image/audio/video uploads without explicit title).
- **`docker-compose.yml`**: **`api`** **`depends_on`** **`minio-init`** **`service_completed_successfully`** (fresh stacks get bucket before API).
- **`apps/*/Dockerfile`**: removed **`# syntax=docker/dockerfile:1.7`** so builds do not require pulling the Dockerfile frontend image from Docker Hub.

Completion criteria (DoD):
- Upload several tracks at once; they appear in the list with titles derived from filenames.
- Play from list or footer; scrub works; delete asks for confirmation and removes track + storage.

Tested:
- **`npm run typecheck`** in **`apps/web`** — OK (includes follow-up).

## T23 — Dedicated Videos route `/video`  [DONE]
Priority: Medium
Status: Done

Add a **Videos** workspace parallel to **Photos**: authenticated **`/video`** page listing **`asset_type === "video"`**, compact upload (**`POST /api/v1/assets`** with video MIME types), grid thumbnails (**`<video preload="metadata">`**), **`GalleryLightbox`** playback, delete with confirmation (**`apiDeleteAsset`**). Expose **Video** in **`DashboardShell`** and gate **`/video`** in middleware like **`/gallery`**.

Depends on:
- T18 (gallery upload/delete/lightbox patterns)
- T13 / T22 (asset APIs and BFF auth)

Completion note:
- **`apps/web/app/(dashboard)/video/page.tsx`** — filter videos, upload toolbar, lightbox, Russian delete modal (same UX as **`/gallery`**).
- **`apps/web/components/video-upload-form.tsx`** — **`Add video`**, **`accept`** MP4/MOV/WebM + **`video/*`**, default **`permission_scope: private`**.
- **`apps/web/components/asset-video-thumb.tsx`** — shared square preview; **`dashboard-home.tsx`** imports it instead of an inline **`VideoThumb`**.
- **`apps/web/components/dashboard-shell.tsx`** — nav **Video** → **`/video`** (between Photos and Music).
- **`apps/web/middleware.ts`** — **`/video`** in **`PROTECTED_PREFIXES`** and **`matcher`**.
- **`dashboard-home.tsx`** — empty-month copy links **Gallery** / **Videos** by media filter.

Tested:
- **`npx tsc --noEmit`** in **`apps/web`** — OK.

