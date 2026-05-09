import { NextRequest, NextResponse } from "next/server";

import { getBackendBaseUrl } from "@/lib/server/backend-url";
import { applyAuthCookies } from "@/lib/server/session-cookies";
import type { TokenResponse } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const url = `${getBackendBaseUrl().replace(/\/$/, "")}/api/v1/auth/login`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
  const payload = await res.text();
  const contentType = res.headers.get("content-type") ?? "application/json";

  if (!res.ok) {
    return new NextResponse(payload, {
      status: res.status,
      headers: { "Content-Type": contentType },
    });
  }

  const tokens = JSON.parse(payload) as TokenResponse;
  const out = NextResponse.json({ ok: true });
  applyAuthCookies(out, tokens, req);
  return out;
}
