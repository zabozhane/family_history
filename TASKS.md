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
- Every UI file carries `// TODO(T12)` markers so the proper Tailwind/shadcn rebuild has clear hooks.

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

## T8 — Implement media metadata extraction background jobs
Priority: Medium
Status: Pending — next recommended task

Develop worker tasks to fetch uploaded media from MinIO, extract metadata using ffmpeg, Pillow, mutagen, and update AssetVersion metadata in the database.

Depends on:
- T6
- T7

## T9 — Develop permission system for private, family, shared scopes
Priority: Medium

Implement framework in API backend to check and enforce asset permissions based on scopes for users across all relevant endpoints.

Depends on:
- T5

## T10 — Build typed, versioned FastAPI RESTful API with OpenAPI docs
Priority: High

Define typed API endpoints for authentication, media upload, timeline retrieval, permission checks, and document API versions with OpenAPI specification.

Depends on:
- T5
- T6
- T9

## T11 — Implement foundational timeline aggregation model
Priority: Medium

Develop backend logic to aggregate Assets, AssetVersions, and TimelineEntries into a unified timeline view respecting permissions and filter criteria.

Depends on:
- T4
- T9

## T12 — Create Next.js frontend shell with authentication integration
Priority: High

Implement frontend authentication flows using JWT tokens from API, including login, logout, and protected routes with Tailwind and shadcn/ui components.

Depends on:
- T10

Note: This task SUPERSEDES T12a — rebuild the auth screens on Tailwind + shadcn/ui, revisit token storage strategy (localStorage → httpOnly cookies), and remove all `// TODO(T12)` markers in `apps/web`.

## T13 — Implement basic photo gallery and music playback
Priority: Medium

Develop UI components for browsing photo gallery and playing music tracks with basic playback controls consuming API data.

Depends on:
- T12
- T10

## T14 — Implement timeline navigation and filtering UI
Priority: Medium

Develop frontend timeline view with filtering by time ranges and asset types, integrating API timeline endpoints and updating UI accordingly.

Depends on:
- T12
- T11

## T15 — Implement environment configuration and strict typing across codebase
Priority: Medium

Ensure all components (api, web, worker) use environment variables for config and enforce TypeScript/Python strict typing for code quality.

Depends on:
- T1

