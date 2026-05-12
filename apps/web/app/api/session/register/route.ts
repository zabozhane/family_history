import { type NextRequest, NextResponse } from "next/server";

import { getBackendBaseUrl } from "@/lib/server/backend-url";
import { applyAuthCookies } from "@/lib/server/session-cookies";
import type { TokenResponse } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const url = `${getBackendBaseUrl().replace(/\/$/, "")}/api/v1/auth/register`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
  } catch {
    return NextResponse.json(
      {
        detail:
          "Cannot reach the API. Use NEXT_PUBLIC_API_BASE_URL (e.g. http://localhost:8000) for local dev; in Docker, keep RUNNING_IN_DOCKER=true.",
      },
      { status: 503 },
    );
  }
  const payload = await res.text();
  const contentType = res.headers.get("content-type") ?? "application/json";

  if (!res.ok) {
    return new NextResponse(payload, {
      status: res.status,
      headers: { "Content-Type": contentType },
    });
  }

  let tokens: TokenResponse;
  try {
    tokens = JSON.parse(payload) as TokenResponse;
  } catch {
    return NextResponse.json(
      { detail: "Invalid response from registration service." },
      { status: 502 },
    );
  }
  const out = NextResponse.json({ ok: true }, { status: 201 });
  applyAuthCookies(out, tokens, req);
  return out;
}
