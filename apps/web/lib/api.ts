// Tiny typed fetch wrapper with one silent refresh attempt on 401.
// TODO(T12): replace with a proper fetcher (SWR/React Query) and OpenAPI-typed client.

import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  saveTokens,
} from "./auth";
import type { ApiError, TokenResponse } from "./types";

const API_BASE_URL: string =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export class ApiRequestError extends Error {
  status: number;
  body: ApiError | null;
  constructor(status: number, message: string, body: ApiError | null) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

async function rawFetch(
  path: string,
  init: RequestInit,
  withAuth: boolean,
): Promise<Response> {
  const headers = new Headers(init.headers ?? {});
  if (init.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (withAuth) {
    const token = getAccessToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }
  return fetch(`${API_BASE_URL}${path}`, { ...init, headers });
}

async function tryRefresh(): Promise<boolean> {
  const refresh = getRefreshToken();
  if (!refresh) return false;
  const res = await rawFetch(
    "/api/v1/auth/refresh",
    {
      method: "POST",
      body: JSON.stringify({ refresh_token: refresh }),
    },
    false,
  );
  if (!res.ok) {
    clearTokens();
    return false;
  }
  const data = (await res.json()) as TokenResponse;
  saveTokens(data.access_token, data.refresh_token);
  return true;
}

async function parseError(res: Response): Promise<ApiError | null> {
  try {
    return (await res.json()) as ApiError;
  } catch {
    return null;
  }
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
  options: { auth?: boolean } = {},
): Promise<T> {
  const auth = options.auth ?? true;
  let res = await rawFetch(path, init, auth);
  if (res.status === 401 && auth) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      res = await rawFetch(path, init, auth);
    }
  }
  if (!res.ok) {
    const body = await parseError(res);
    const detail =
      typeof body?.detail === "string" ? body.detail : `HTTP ${res.status}`;
    throw new ApiRequestError(res.status, detail, body);
  }
  if (res.status === 204) return undefined as unknown as T;
  return (await res.json()) as T;
}

export const apiBaseUrl = API_BASE_URL;
