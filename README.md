# Family Media System

Private, multi-user family media and digital memory platform: photos, music, video, and timeline in a workspace-scoped personal cloud. Every item is an **asset** with versions in object storage; the **timeline** aggregates activity over time with permission-aware access.

**Status:** MVP implemented locally via Docker (auth, uploads, metadata worker, gallery/music/video UI, timeline dashboard, workspaces, invitations, join requests, notifications). Task history: [`TASKS.md`](TASKS.md). Architecture: [`ARCHITECTURE.md`](ARCHITECTURE.md).

## Stack

| Layer | Technology |
| --- | --- |
| Web | Next.js (App Router), TypeScript, Tailwind, shadcn/ui |
| API | Python 3.12, FastAPI, SQLAlchemy 2, Alembic |
| Worker | Dramatiq + Redis |
| Data | PostgreSQL 16 |
| Storage | S3-compatible (MinIO locally) |
| Media | ffmpeg, Pillow, mutagen (worker) |
| Runtime | Docker Compose |

## Repository layout

```
apps/
  api/       FastAPI backend, Alembic migrations
  web/       Next.js UI + BFF session proxy (`/api/fms/*`, `/api/session/*`)
  worker/    Dramatiq consumers (metadata extraction)
infrastructure/   nginx/scripts placeholders for future deploy
packages/         shared-types, shared-utils (stubs)
docker-compose.yml
.env.example      copy to `.env` (gitignored)
```

## Quick start (local)

Requires **Docker** and **Docker Compose v2**.

```bash
cp .env.example .env
# Replace every REPLACE_WITH_* in `.env`, or run the bootstrap snippet at the top of `.env.example`.

docker compose up -d --build
docker compose exec api alembic upgrade head   # required on first run or after `down -v`
```

Useful commands:

```bash
docker compose ps
docker compose logs -f api          # or worker, web
docker compose down                 # stop; volumes kept
docker compose down -v              # stop and wipe DB / Redis / MinIO data
```

If you change `POSTGRES_PASSWORD` after Postgres was initialized, run `docker compose down -v` before `up` so the volume is recreated.

After `docker compose down -v`, run migrations again before using the API.

Rebuild app images after pulling API/web/worker changes:

```bash
docker compose build api web worker && docker compose up -d
docker compose exec api alembic upgrade head
```

## Services

| Service | URL | Notes |
| --- | --- | --- |
| Web | http://localhost:3000 | Dashboard, gallery, music, video |
| API | http://localhost:8000 | `GET /health`, OpenAPI at `/docs` |
| MinIO Console | http://localhost:9001 | `S3_ACCESS_KEY` / `S3_SECRET_KEY` from `.env` |
| MinIO S3 API | http://localhost:9000 | Bucket from `S3_BUCKET` (default `family-media`) |
| PostgreSQL | localhost:5432 | `POSTGRES_*` in `.env` |
| Redis | localhost:6379 | Dramatiq broker |
| Worker | — | No HTTP port; `docker compose logs -f worker` |

The browser talks to the API through the Next.js BFF (`NEXT_PUBLIC_API_BASE_URL` for client hints; `API_INTERNAL_BASE_URL=http://api:8000` inside Compose). Access tokens are stored in **httpOnly cookies** via `/api/session/login` and `/api/session/register`.

## Web UI

| Path | Description |
| --- | --- |
| `/` | Landing (guest) or timeline dashboard (signed in) |
| `/login`, `/register` | Auth |
| `/gallery` | Photo library + upload |
| `/video` | Video library + upload |
| `/music` | Music library, player, upload |
| `/timeline` | Full timeline view |
| `/me` | Profile |
| `/workspace/[workspaceId]/members` | Shared workspace members (owner/member) |

Sidebar **workspace switcher**: personal workspace plus shared workspaces you own or joined. Notifications bell for join-request and invitation events.

Protected routes (`/gallery`, `/video`, `/music`, `/timeline`, `/me`) redirect to `/login` without a session cookie.

## API (`/api/v1`)

OpenAPI: http://localhost:8000/docs

### Auth & users

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/auth/register` | Create account (`family` role) → tokens |
| `POST` | `/auth/login` | Email + password → tokens |
| `POST` | `/auth/refresh` | Refresh token → new pair |
| `GET` | `/users/me` | Current user (Bearer) |
| `GET` | `/admin/ping` | Admin-only smoke route |

### Assets & timeline

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/assets` | Multipart upload (image / audio / video); optional `workspace_id`, `permission_scope` |
| `GET` | `/assets` | List/filter assets (workspace-scoped ACL) |
| `GET` | `/assets/{id}` | Asset metadata |
| `GET` | `/assets/{id}/file` | Stream file from object storage |
| `GET` | `/assets/{id}/permission` | Effective permission for caller |
| `DELETE` | `/assets/{id}` | Delete asset (capability-checked) |
| `GET` | `/timeline` | Timeline entries for active workspace |

### Workspaces & sharing

| Method | Path | Description |
| --- | --- | --- |
| `GET`, `POST` | `/workspaces` | List / create workspaces |
| `POST` | `/workspaces/{id}/invitations` | Invite by email (capabilities: read / upload / delete) |
| `GET`, `DELETE` | `/workspaces/{id}/invitations` | List / revoke invitations |
| `POST` | `/invitations/accept` | Accept invitation token |
| `GET` | `/workspaces/{id}/members` | Member roster (shared workspaces) |
| `PATCH`, `DELETE` | `/workspaces/{id}/members/{userId}` | Update capabilities / remove member |
| `POST` | `/workspaces/{id}/join-requests` | Request to join shared workspace |
| `GET`, `DELETE`, `POST …/respond` | `/workspaces/{id}/join-requests` | Owner manages requests |
| `GET` | `/workspace-join-requests` | Caller’s outgoing join requests |

### Notifications

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/notifications` | Inbox (optional `workspace_id`) |
| `PATCH` | `/notifications/{id}/read` | Mark read |

## Domain model (summary)

- **User** — roles: `admin`, `family`, `child`, `guest`
- **Workspace** — `personal` (one per user) or `shared`; memberships with per-member capabilities
- **Asset** / **AssetVersion** — typed media (`image`, `audio`, `video`); files in S3; scopes: `private`, `family`, `shared`
- **TimelineEntry** — aggregates asset activity for the timeline UI
- **WorkspaceInvitation**, **WorkspaceJoinRequest**, **Notification**

## Implemented vs planned

**In scope today**

- Dockerized monolith (api + web + worker + postgres + redis + minio)
- JWT auth, cookie-based web sessions, role checks
- Upload pipeline, streaming playback, background metadata extraction
- Gallery, music player, video page, timeline dashboard with time filters
- Multi-workspace tenancy, invitations, join requests, member management UI

**Out of scope for MVP** (see also original goals below)

- AI / semantic search, microservices, Kubernetes
- Full transcoding, waveforms, command palette, drag-and-drop uploads
- Files stored in PostgreSQL

## Related docs

- [`ARCHITECTURE.md`](ARCHITECTURE.md) — components and data flow
- [`TASKS.md`](TASKS.md) — implementation checklist (T1–T30 done)
- [`apps/api/README.md`](apps/api/README.md), [`apps/web/README.md`](apps/web/README.md), [`apps/worker/README.md`](apps/worker/README.md) — per-app notes

## Original product goals (reference)

- Modular `apps/web`, `apps/api`, `apps/worker` structure
- Timeline-centered UX with permissions (private / family / shared)
- Typed versioned REST API with OpenAPI
- Async media processing; strict typing and env-based config

## Non-goals

- Advanced AI (embeddings, semantic search)
- Microservices or Kubernetes in MVP
- Heavy transcoding / editing / social features
- Command palette or drag-and-drop uploads at MVP
- Storing blobs in the database
