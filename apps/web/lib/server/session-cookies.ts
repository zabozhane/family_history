import type { NextRequest } from "next/server";
import type { NextResponse } from "next/server";

import { FMS_ACCESS_COOKIE, FMS_REFRESH_COOKIE } from "@/lib/cookies";

type TokenBundle = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
};

/** Use Secure cookies only over HTTPS (see incoming URL / reverse-proxy headers). */
export function isHttpsRequest(req: NextRequest): boolean {
  const forwarded = req.headers
    .get("x-forwarded-proto")
    ?.split(",")[0]
    ?.trim()
    .toLowerCase();
  if (forwarded === "https") return true;
  if (forwarded === "http") return false;
  return req.nextUrl.protocol === "https:";
}

function cookieBaseOptions(req: NextRequest) {
  return {
    httpOnly: true,
    secure: isHttpsRequest(req),
    sameSite: "lax" as const,
    path: "/",
  };
}

export function applyAuthCookies(
  res: NextResponse,
  tokens: TokenBundle,
  req: NextRequest,
): void {
  const base = cookieBaseOptions(req);
  res.cookies.set(FMS_ACCESS_COOKIE, tokens.access_token, {
    ...base,
    maxAge: tokens.expires_in,
  });
  res.cookies.set(FMS_REFRESH_COOKIE, tokens.refresh_token, {
    ...base,
    maxAge: 60 * 60 * 24 * 30,
  });
}

export function clearAuthCookies(res: NextResponse, req: NextRequest): void {
  const base = cookieBaseOptions(req);
  res.cookies.set(FMS_ACCESS_COOKIE, "", { ...base, maxAge: 0 });
  res.cookies.set(FMS_REFRESH_COOKIE, "", { ...base, maxAge: 0 });
}
