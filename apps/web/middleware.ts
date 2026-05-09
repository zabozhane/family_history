import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { FMS_ACCESS_COOKIE } from "@/lib/cookies";

const PROTECTED_PREFIXES = ["/me", "/gallery", "/music", "/timeline"];

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const needsAuth = PROTECTED_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
  if (needsAuth) {
    const token = request.cookies.get(FMS_ACCESS_COOKIE)?.value;
    if (!token) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/me",
    "/me/:path*",
    "/gallery",
    "/gallery/:path*",
    "/music",
    "/music/:path*",
    "/timeline",
    "/timeline/:path*",
  ],
};
