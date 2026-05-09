import type { AssetType, TimelineEntryKind } from "@/lib/types";

export type TimelineFetchFilters = {
  limit?: number;
  offset?: number;
  /** ISO 8601 datetime */
  from?: string;
  /** ISO 8601 datetime */
  to?: string;
  assetType?: AssetType | null;
  kind?: TimelineEntryKind | null;
};

/** Query string for `GET /api/v1/timeline` (FastAPI aliases `from` / `to`). */
export function buildTimelineSearchParams(filters: TimelineFetchFilters): string {
  const sp = new URLSearchParams();
  const limit = filters.limit ?? 50;
  const offset = filters.offset ?? 0;
  sp.set("limit", String(limit));
  sp.set("offset", String(offset));
  if (filters.from) sp.set("from", filters.from);
  if (filters.to) sp.set("to", filters.to);
  if (filters.assetType) sp.set("asset_type", filters.assetType);
  if (filters.kind) sp.set("kind", filters.kind);
  return sp.toString();
}

/** Convert `<input type="datetime-local">` value to ISO string for the API. */
export function datetimeLocalToIso(value: string): string | undefined {
  if (!value.trim()) return undefined;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}
