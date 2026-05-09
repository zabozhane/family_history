# Session Handoff

## Completed In This Session

### T16 — Dashboard shell (layout + navigation)

- **`DashboardShell`** (`components/dashboard-shell.tsx`): sidebar **Family Media**, nav **Timeline** (`/#dashboard-timeline`), **Photos** (`/gallery`), **Music** (`/music`), **Profile** (`/me`), footer **Log out** via **`SignOutButton`** with **`label`**.
- **Route group** **`app/(dashboard)/`**: **`layout.tsx`** wraps **`/gallery`**, **`/music`**, **`/timeline`**, **`/me`** (URLs unchanged). **`SiteNav`** removed from root layout; **`site-nav.tsx`** deleted.
- **Authenticated `/`**: **`DashboardShell`** + placeholder **`#dashboard-timeline`** + links to full **`/timeline`** / sections until **T17**. Guests: marketing-only **Sign in** / **Create account**.
- **Login / register** success → **`window.location.assign("/")`** (full load so **`/`** sees new cookies; avoids stale RSC after **`router.push`**).

### Auth fixes (post-T16, Docker / localhost)

- **`/`** **`dynamic = "force-dynamic"`** — home always uses fresh **`cookies()`**.
- **HttpOnly cookies**: **`Secure`** flag only when the browser request is actually HTTPS (**`isHttpsRequest(req)`** from **`x-forwarded-proto`** + URL protocol). Fixes **`NODE_ENV=production`** + **`http://localhost:3000`** where **`Secure`** cookies were ignored by the browser.
- **`applyAuthCookies` / `clearAuthCookies`** take **`NextRequest`**; wired from session routes + **`backend-proxy`** on token refresh / failed refresh.

## Test Summary

- `npm run typecheck` && `npm run build` in **`apps/web`** — OK.
- **`docker compose build web && docker compose up -d web`** — login → dashboard with sidebar.

## How To Test (repeatable)

- Web: `cd apps/web && npm run typecheck && npm run build`
- Cookie smoke (Compose): open **`http://localhost:3000/login`**, sign in → **`/`** must show sidebar (not marketing-only screen).
- After route moves: if **`tsc`** fails on missing **`app/gallery/page`**, remove **`apps/web/.next`** and rebuild.

## Current Stack State

**T1–T16** done per **`TASKS.md`**. Next: **T17** (home time-range strip + filtered photos + bottom player), then **T18** (photos upload UI).

## Known Issues / Risks

- Stale **`apps/web/.next`** after moving routes can confuse **`tsc`** until cache cleared.
- **`/`** is not middleware-protected; shell appears whenever **`fms_access`** exists (even if expired).
- Behind HTTPS terminator: ensure **`X-Forwarded-Proto: https`** so refreshed cookies stay **`Secure`** when appropriate.

## Next Recommended Task

**T17 — Home dashboard: time-range strip, filtered photos, bottom player.**

## Notes For Next Session

- Read **`CURSOR_EXECUTION_MODE.md`** + **`.ai/*.json`** first.
- Implement real **`#dashboard-timeline`** region + photo strip + player on **`/`** per **T17**.
