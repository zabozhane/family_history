import type { NextResponse } from "next/server";

import { FMS_ACCESS_COOKIE, FMS_REFRESH_COOKIE } from "@/lib/cookies";

type TokenBundle = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
};

function cookieBaseOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
  };
}

export function applyAuthCookies(res: NextResponse, tokens: TokenBundle): void {
  res.cookies.set(FMS_ACCESS_COOKIE, tokens.access_token, {
    ...cookieBaseOptions(),
    maxAge: tokens.expires_in,
  });
  res.cookies.set(FMS_REFRESH_COOKIE, tokens.refresh_token, {
    ...cookieBaseOptions(),
    maxAge: 60 * 60 * 24 * 30,
  });
}

export function clearAuthCookies(res: NextResponse): void {
  res.cookies.delete(FMS_ACCESS_COOKIE);
  res.cookies.delete(FMS_REFRESH_COOKIE);
}
