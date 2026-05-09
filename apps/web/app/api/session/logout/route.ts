import { NextResponse } from "next/server";

import { clearAuthCookies } from "@/lib/server/session-cookies";

export const dynamic = "force-dynamic";

export async function POST() {
  const out = NextResponse.json({ ok: true });
  clearAuthCookies(out);
  return out;
}
