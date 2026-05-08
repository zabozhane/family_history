# Family Media System / Digital Memory Platform

## Project Idea
A private, multi-user family media and digital memory platform unifying photos, music, videos, notes, events, and more into a timeline-centered personal cloud system. Everything is an asset, and all assets happen in time, supporting permissions and family-oriented sharing.

## Preferred Stack
Frontend: Next.js, TypeScript, Tailwind, shadcn/ui; Backend: Python, FastAPI; Database: PostgreSQL; Cache/Queue: Redis; Background Jobs: Dramatiq or Celery; Storage: S3-compatible (MinIO for local); ORM: SQLAlchemy; Auth: JWT + refresh tokens; Media Processing: ffmpeg, Pillow, mutagen; Containerization: Docker, docker-compose

## Constraints
- minimal mvp

## Quick Start (local)
Requires Docker + Docker Compose v2.

```bash
cp .env.example .env             # one-time: copy template (gitignored)
# Edit `.env` and replace every REPLACE_WITH_* placeholder with random secrets,
# or paste the bootstrap snippet from the top of `.env.example`.
docker compose up -d --build     # build + start all services
docker compose ps                # services + healthchecks
docker compose down              # stop everything (volumes preserved)
docker compose down -v           # stop and wipe data volumes
```

If you rotate `POSTGRES_PASSWORD` after Postgres was already initialized, run `docker compose down -v` before `up` so the DB volume is recreated with the new password.

After `docker compose down -v` (empty database), run migrations before using the API:

```bash
docker compose exec api alembic upgrade head
```

### Auth (API v1)
| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/api/v1/auth/register` | Create account (role `family`); returns access + refresh tokens |
| `POST` | `/api/v1/auth/login` | Email + password → tokens |
| `POST` | `/api/v1/auth/refresh` | Refresh token → new token pair |
| `GET` | `/api/v1/users/me` | Current user (Bearer access token) |
| `GET` | `/api/v1/admin/ping` | Example admin-only route (Bearer; live `users.role` in DB) |

### Web (T12a — minimal dev UI; superseded by full T12)
| Path | Description |
| --- | --- |
| `/` | Anonymous landing with links to login / register / me |
| `/login` | Sign in form |
| `/register` | Self-service registration (creates `family`-role member) |
| `/me` | Authenticated profile page (redirects to `/login` without a token) |

| Service | URL | Notes |
| --- | --- | --- |
| API (FastAPI) | http://localhost:8000 | `GET /health`, OpenAPI at `/docs` |
| Web (Next.js) | http://localhost:3000 | placeholder home page (T2) |
| MinIO Console | http://localhost:9001 | login: values of `S3_ACCESS_KEY` / `S3_SECRET_KEY` in `.env` |
| MinIO S3 API | http://localhost:9000 | bucket `family-media` auto-created |
| PostgreSQL | localhost:5432 | db/user/password from `.env` (`POSTGRES_*`) |
| Redis | localhost:6379 | broker for Dramatiq worker |

The `worker` service is a Dramatiq consumer (no exposed port); inspect with `docker compose logs -f worker`.

## Goals
- Establish modular project structure with apps/web/api/worker directories
- Set up Docker and docker-compose for local development with PostgreSQL, Redis, MinIO
- Implement core domain models: User, Asset, AssetVersion, TimelineEntry with DB schemas and migrations
- Build secure JWT-based authentication system with user roles (admin, family member, child, guest)
- Create upload pipeline skeleton supporting image/audio/video uploads storing metadata and files in object storage
- Develop foundational timeline model that aggregates assets/events for unified timeline view
- Develop typed, RESTful, versioned FastAPI backend with OpenAPI docs
- Implement frontend shell in Next.js with Tailwind supporting authentication, media browsing, and timeline navigation
- Implement basic media browsing: photo gallery, music playback, timeline filtering
- Implement permissions system supporting private, family, shared scopes
- Set up async task processing for media metadata extraction and background jobs
- Ensure strict typing, environment config, and clean code structure throughout

## Non-goals
- No advanced AI features like embeddings or semantic search in MVP
- No microservices or Kubernetes orchestration in MVP
- No full media transcoding, waveform generation, or complex media editing features initially
- No social networking, enterprise features, or large-scale distributed systems
- No implementing command palette or drag & drop uploads at MVP
- No storing files inside the database
- No overengineering or excessive abstraction beyond modular monolith
