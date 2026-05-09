import type { NextRequest } from "next/server";

import { proxyApiRequest } from "@/lib/server/backend-proxy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function handle(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const { path } = await ctx.params;
  return proxyApiRequest(req, path);
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
export const HEAD = handle;
export const OPTIONS = handle;
