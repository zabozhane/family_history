/**
 * Server-only environment accessors for Route Handlers and Node runtime code.
 * Do not import from Edge Middleware or client components.
 */

/** Public API URL baked into the client bundle (browser-facing absolute URLs when needed). */
export function getPublicApiBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  return raw && raw.length > 0 ? raw : "http://localhost:8000";
}

/**
 * Server-side URL for proxy Route Handlers (`/api/session/*`).
 *
 * Use Docker-internal hostname only when explicitly opted in (Compose sets
 * `RUNNING_IN_DOCKER=true`). Otherwise always use the public URL — avoids 500s when
 * running `next dev` on the host with `API_INTERNAL_BASE_URL=http://api:8000` in `.env`.
 */
export function getBackendBaseUrl(): string {
  const internal = process.env.API_INTERNAL_BASE_URL?.trim();
  const useInternal =
    process.env.RUNNING_IN_DOCKER === "true" ||
    process.env.FMS_USE_INTERNAL_API === "true";
  if (useInternal && internal && internal.length > 0) {
    return internal;
  }
  return getPublicApiBaseUrl();
}
