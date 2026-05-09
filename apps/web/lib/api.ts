import type { ApiError, AssetUploadResponse } from "./types";

const PROXY_PREFIX = "/api/fms";

/** Maps `/api/v1/...` requests to the Next.js BFF proxy (`/api/fms/v1/...`). */
export function toProxiedApiPath(path: string): string {
  const trimmed = path.startsWith("/") ? path.slice(1) : path;
  const withoutApiPrefix = trimmed.startsWith("api/")
    ? trimmed.slice("api/".length)
    : trimmed;
  return `${PROXY_PREFIX}/${withoutApiPrefix}`;
}

export class ApiRequestError extends Error {
  status: number;
  body: ApiError | null;
  constructor(status: number, message: string, body: ApiError | null) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

async function parseError(res: Response): Promise<ApiError | null> {
  try {
    return (await res.json()) as ApiError;
  } catch {
    return null;
  }
}

function formatApiDetail(body: ApiError | null, status: number): string {
  const d = body?.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) {
    const parts = d
      .map((item) =>
        typeof item === "object" && item !== null && "msg" in item
          ? String((item as { msg: string }).msg)
          : "",
      )
      .filter(Boolean);
    if (parts.length > 0) return parts.join("; ");
  }
  return `HTTP ${status}`;
}

/** Multipart upload to `POST /api/v1/assets` via BFF (`credentials: include`). */
export async function apiUploadAsset(
  formData: FormData,
): Promise<AssetUploadResponse> {
  const url = toProxiedApiPath("/api/v1/assets");
  const res = await fetch(url, {
    method: "POST",
    body: formData,
    credentials: "include",
  });
  if (!res.ok) {
    const body = await parseError(res);
    throw new ApiRequestError(
      res.status,
      formatApiDetail(body, res.status),
      body,
    );
  }
  return (await res.json()) as AssetUploadResponse;
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const url = toProxiedApiPath(path);
  const headers = new Headers(init.headers ?? {});
  if (
    init.body !== undefined &&
    !headers.has("Content-Type") &&
    !(init.body instanceof FormData)
  ) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(url, { ...init, headers, credentials: "include" });
  if (!res.ok) {
    const body = await parseError(res);
    throw new ApiRequestError(
      res.status,
      formatApiDetail(body, res.status),
      body,
    );
  }
  if (res.status === 204) return undefined as unknown as T;
  return (await res.json()) as T;
}

export async function sessionLogin(
  email: string,
  password: string,
): Promise<void> {
  const res = await fetch("/api/session/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const body = await parseError(res);
    const detail =
      typeof body?.detail === "string" ? body.detail : `HTTP ${res.status}`;
    throw new ApiRequestError(res.status, detail, body);
  }
}

export async function sessionRegister(payload: {
  email: string;
  password: string;
  display_name: string;
}): Promise<void> {
  const res = await fetch("/api/session/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await parseError(res);
    const detail =
      typeof body?.detail === "string" ? body.detail : `HTTP ${res.status}`;
    throw new ApiRequestError(res.status, detail, body);
  }
}
