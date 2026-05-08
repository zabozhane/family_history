# Session Handoff

## Completed In This Session
**T12a — Minimal login/register UI (out-of-order, dev-only).** A browser-reachable auth flow in `apps/web` so the project can be exercised before full T12 (Tailwind + shadcn/ui) lands.

- **API**
  - `app/main.py`: `CORSMiddleware` (allow_methods/headers `*`, no credentials).
  - `app/core/config.py`: `CORS_ALLOWED_ORIGINS` (default `["http://localhost:3000"]`).
- **Web build**
  - `apps/web/Dockerfile`: `ARG NEXT_PUBLIC_API_BASE_URL` + `ENV` in `builder` stage so it is inlined into the Next.js bundle.
  - `docker-compose.yml`: `web.build.args.NEXT_PUBLIC_API_BASE_URL` plumbed from `.env`.
- **Web client**
  - `lib/types.ts`: `UserRead`, `TokenResponse`, `ApiError` (mirrors `app/schemas/{auth,user}.py`).
  - `lib/auth.ts`: `localStorage`-backed token helpers (TODO(T12) → httpOnly cookies).
  - `lib/api.ts`: typed `apiFetch<T>(path, init, { auth })` with one silent `/auth/refresh` retry on 401, then logout.
  - `lib/styles.ts`: tiny inline-style atoms (TODO(T12) → Tailwind/shadcn).
- **Web pages**
  - `app/login/page.tsx`, `app/register/page.tsx`, `app/me/page.tsx` — client components with simple forms.
  - `app/page.tsx`: anonymous landing with links to `/login`, `/register`, `/me`.
- **TASKS.md**: T12a recorded as Done with explicit "T12 supersedes T12a" note inside T12.

## Test Summary
- `docker compose build api web && docker compose up -d` — both services healthy.
- CORS:
  - Preflight (Origin `http://localhost:3000`) → 200, allow-origin `http://localhost:3000`.
  - Preflight (Origin `http://evil.example`) → 400, no allow-origin header.
  - Actual `POST /auth/login` from allowed origin returns the right status with allow-origin header set.
- Bundle inspection: `localhost:8000` is baked into `/app/.next/server/app/{login,register,me}/page.js`.
- E2E (curl with `Origin: http://localhost:3000`): register OK → `/users/me` returns user → login OK → bogus access token returns 401 (triggers client refresh) → `/auth/refresh` returns a new pair.
- `curl http://localhost:3000/login` renders the Next.js page with `<title>Family Media System</title>`.

## How To Use
1. Open `http://localhost:3000`.
2. Click **Create account** → fill display name + email + password (≥ 8 chars) → submit → you land on `/me`.
3. Click **Logout** → you go to `/login`. Sign in with the same credentials → back on `/me`.

## Current Stack State
`docker compose ps`: api healthy, postgres/redis/minio healthy, web running, worker running.

## Known Issues / Risks
- Tokens live in `localStorage` (XSS vulnerable). Acceptable for dev MVP; revisit in T12 proper.
- `NEXT_PUBLIC_API_BASE_URL` is baked at build time. If the URL changes (e.g. deploy to a different host), `docker compose build web` is required.
- No server-side refresh rotation / revocation list. Refresh tokens valid until `exp`.
- Inline styles will be rewritten in T12 proper. All UI files have `// TODO(T12)` markers.
- `docker compose down -v` still wipes the DB; remember `docker compose exec api alembic upgrade head` after a fresh boot.

## Next Recommended Task
**T6 — Upload pipeline skeleton.** The intended-by-plan next step.
- Add `aioboto3` (or `boto3`) to `apps/api/requirements.txt`.
- New module `app/storage/s3.py` building an S3 client from settings (`S3_ENDPOINT_URL`, keys, bucket).
- New router `app/api/v1/assets.py`: `POST /api/v1/assets` (multipart upload) — accepts file, infers `AssetType` from MIME, uploads to MinIO under `{user_id}/{asset_id}/{version_id}{ext}`, creates `Asset` + primary `AssetVersion` rows.
- Auth: `Depends(get_current_user)`. Permission scope: default `private`.
- No metadata extraction yet (that's T8) — store mime/size now, leave width/height/duration/metadata empty/`{}`.
- Tests: curl with a small image → 201 with the asset row; verify object exists in `family-media` bucket via `mc`.

## Notes For Next Session
- Read `CURSOR_EXECUTION_MODE.md` + `.ai/*.json` first.
- Keep T6 narrow (no Dramatiq enqueue yet — that's T7).
- Stack is left UP after this session.
