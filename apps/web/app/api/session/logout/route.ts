import { type NextRequest, NextResponse } from "next/server";

import { clearAuthCookies } from "@/lib/server/session-cookies";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const out = NextResponse.json({ ok: true });
  clearAuthCookies(out, req);
  return out;
}
