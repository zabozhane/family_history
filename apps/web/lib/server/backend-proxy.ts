import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { FMS_ACCESS_COOKIE, FMS_REFRESH_COOKIE } from "@/lib/cookies";
import { getBackendBaseUrl } from "@/lib/server/backend-url";
import {
  applyAuthCookies,
  clearAuthCookies,
} from "@/lib/server/session-cookies";
import type { TokenResponse } from "@/lib/types";

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
]);

function normalizeBase(): string {
  return getBackendBaseUrl().replace(/\/$/, "");
}

function buildTargetUrl(req: NextRequest, pathSegments: string[]): URL {
  const targetPath = `/api/${pathSegments.join("/")}`;
  const incoming = new URL(req.url);
  const target = new URL(targetPath, `${normalizeBase()}/`);
  target.search = incoming.search;
  return target;
}

function forwardHeaders(
  req: NextRequest,
  accessToken: string | null,
  pathSegments: string[],
): Headers {
  const headers = new Headers();
  req.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (HOP_BY_HOP.has(lower) || lower === "cookie" || lower === "host") {
      return;
    }
    headers.set(key, value);
  });
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }
  /** Avoid gzip/br on binary streams — corrupted bodies break `<video>` / `<audio>` through the BFF. */
  const isAssetFile =
    pathSegments.length >= 2 &&
    pathSegments[pathSegments.length - 1] === "file" &&
    pathSegments.includes("assets");
  if (isAssetFile) {
    headers.set("accept-encoding", "identity");
  }
  return headers;
}

async function refreshTokens(refreshToken: string): Promise<TokenResponse | null> {
  const res = await fetch(`${normalizeBase()}/api/v1/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!res.ok) return null;
  return (await res.json()) as TokenResponse;
}

async function toNextResponse(backendRes: Response): Promise<NextResponse> {
  const headers = new Headers(backendRes.headers);
  headers.delete("transfer-encoding");
  return new NextResponse(backendRes.body, {
    status: backendRes.status,
    statusText: backendRes.statusText,
    headers,
  });
}

async function backendFetch(
  req: NextRequest,
  targetUrl: URL,
  accessToken: string | null,
  pathSegments: string[],
): Promise<Response> {
  const headers = forwardHeaders(req, accessToken, pathSegments);
  const init: RequestInit & { duplex?: string } = {
    method: req.method,
    headers,
    redirect: "manual",
  };
  if (req.body) {
    init.body = req.body;
    init.duplex = "half";
  }
  return fetch(targetUrl, init);
}

export async function proxyApiRequest(
  req: NextRequest,
  pathSegments: string[],
): Promise<NextResponse> {
  const targetUrl = buildTargetUrl(req, pathSegments);
  const access = req.cookies.get(FMS_ACCESS_COOKIE)?.value ?? null;
  const refresh = req.cookies.get(FMS_REFRESH_COOKIE)?.value ?? null;

  let backendRes = await backendFetch(req, targetUrl, access, pathSegments);

  if (backendRes.status === 401 && refresh) {
    const tokens = await refreshTokens(refresh);
    if (tokens) {
      backendRes = await backendFetch(req, targetUrl, tokens.access_token, pathSegments);
      const out = await toNextResponse(backendRes);
      applyAuthCookies(out, tokens, req);
      return out;
    }
    const out = await toNextResponse(backendRes);
    clearAuthCookies(out, req);
    return out;
  }

  return toNextResponse(backendRes);
}
