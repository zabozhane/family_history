/**
 * Server-only environment accessors for Route Handlers and Node runtime code.
 * Do not import from Edge Middleware or client components.
 */

/** Public API URL baked into the client bundle (browser-facing absolute URLs when needed). */
export function getPublicApiBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  return raw && raw.length > 0 ? raw : "http://localhost:8000";
}

/** Prefer Docker-internal URL for server-side proxy hops; fall back to public URL for local dev. */
export function getBackendBaseUrl(): string {
  const internal = process.env.API_INTERNAL_BASE_URL?.trim();
  if (internal && internal.length > 0) return internal;
  return getPublicApiBaseUrl();
}
