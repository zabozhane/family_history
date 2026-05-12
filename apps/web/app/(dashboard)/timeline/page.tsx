"use client";

import type { FormEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiRequestError, apiFetch } from "@/lib/api";
import { useWorkspace } from "@/components/workspace-context";
import { assetFileUrl } from "@/lib/media-url";
import {
  buildTimelineSearchParams,
  datetimeLocalToIso,
} from "@/lib/timeline-query";
import type { AssetType, TimelineEntryKind, TimelineItemRead } from "@/lib/types";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 50;

const ASSET_TYPES: AssetType[] = [
  "image",
  "video",
  "audio",
  "note",
  "document",
  "voice_note",
  "link",
  "archive",
];

const KINDS: TimelineEntryKind[] = ["asset_added", "event", "activity"];

type CommittedFilters = {
  from?: string;
  to?: string;
  assetType: AssetType | null;
  kind: TimelineEntryKind | null;
};

const EMPTY_COMMITTED: CommittedFilters = {
  assetType: null,
  kind: null,
};

const selectClass = cn(
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
  "ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
  "disabled:cursor-not-allowed disabled:opacity-50",
);

function formatWhen(iso: string): string {
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(d);
  } catch {
    return iso;
  }
}

function payloadSummary(payload: Record<string, unknown>): string | null {
  if (!payload || typeof payload !== "object") return null;
  const parts: string[] = [];
  const ev = payload.event;
  if (typeof ev === "string") parts.push(ev);
  const at = payload.asset_type;
  if (typeof at === "string") parts.push(at);
  const ps = payload.permission_scope;
  if (typeof ps === "string") parts.push(ps);
  return parts.length ? parts.join(" · ") : null;
}

export default function TimelinePage() {
  const { ready, activeWorkspaceId } = useWorkspace();

  const [committed, setCommitted] = useState<CommittedFilters>(EMPTY_COMMITTED);
  const [items, setItems] = useState<TimelineItemRead[]>([]);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  const [fromLocal, setFromLocal] = useState("");
  const [toLocal, setToLocal] = useState("");
  const [assetType, setAssetType] = useState<"" | AssetType>("");
  const [kind, setKind] = useState<"" | TimelineEntryKind>("");

  useEffect(() => {
    if (!ready) return;
    if (!activeWorkspaceId) {
      setItems([]);
      setLoading(false);
      setHasMore(false);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    const qs = buildTimelineSearchParams({
      limit: PAGE_SIZE,
      offset: 0,
      from: committed.from,
      to: committed.to,
      assetType: committed.assetType ?? undefined,
      kind: committed.kind ?? undefined,
      workspaceId: activeWorkspaceId,
    });
    apiFetch<TimelineItemRead[]>(`/api/v1/timeline?${qs}`)
      .then((rows) => {
        if (!cancelled) {
          setItems(rows);
          setHasMore(rows.length === PAGE_SIZE);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof ApiRequestError
              ? err.message
              : err instanceof Error
                ? err.message
                : "Failed to load timeline",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [committed, ready, activeWorkspaceId]);

  function handleApply(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCommitted({
      from: datetimeLocalToIso(fromLocal),
      to: datetimeLocalToIso(toLocal),
      assetType: assetType || null,
      kind: kind || null,
    });
  }

  const handleLoadMore = useCallback(async () => {
    if (!activeWorkspaceId) return;
    setLoadingMore(true);
    setError(null);
    const offset = itemsRef.current.length;
    const qs = buildTimelineSearchParams({
      limit: PAGE_SIZE,
      offset,
      from: committed.from,
      to: committed.to,
      assetType: committed.assetType ?? undefined,
      kind: committed.kind ?? undefined,
      workspaceId: activeWorkspaceId,
    });
    try {
      const rows = await apiFetch<TimelineItemRead[]>(
        `/api/v1/timeline?${qs}`,
      );
      setHasMore(rows.length === PAGE_SIZE);
      setItems((prev) => [...prev, ...rows]);
    } catch (err) {
      setError(
        err instanceof ApiRequestError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to load more",
      );
    } finally {
      setLoadingMore(false);
    }
  }, [committed, activeWorkspaceId]);

  function handleReset() {
    setFromLocal("");
    setToLocal("");
    setAssetType("");
    setKind("");
    setCommitted(EMPTY_COMMITTED);
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Timeline</h1>
        <p className="text-sm text-muted-foreground">
          Recent activity you can see (newest first). Adjust filters and apply.
        </p>
      </div>

      <Card className="mb-8">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Filters</CardTitle>
          <CardDescription>
            Uses API query params <code className="text-xs">from</code>,{" "}
            <code className="text-xs">to</code>,{" "}
            <code className="text-xs">asset_type</code>,{" "}
            <code className="text-xs">kind</code>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={handleApply}
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            <div className="space-y-2">
              <Label htmlFor="tl-from">From</Label>
              <Input
                id="tl-from"
                type="datetime-local"
                value={fromLocal}
                onChange={(ev) => setFromLocal(ev.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tl-to">To</Label>
              <Input
                id="tl-to"
                type="datetime-local"
                value={toLocal}
                onChange={(ev) => setToLocal(ev.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tl-asset-type">Asset type</Label>
              <select
                id="tl-asset-type"
                className={selectClass}
                value={assetType}
                onChange={(ev) =>
                  setAssetType((ev.target.value || "") as "" | AssetType)
                }
              >
                <option value="">Any</option>
                {ASSET_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tl-kind">Entry kind</Label>
              <select
                id="tl-kind"
                className={selectClass}
                value={kind}
                onChange={(ev) =>
                  setKind((ev.target.value || "") as "" | TimelineEntryKind)
                }
              >
                <option value="">Any</option>
                {KINDS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap items-end gap-2 sm:col-span-2 lg:col-span-3">
              <Button type="submit" disabled={loading}>
                {loading ? "Loading…" : "Apply filters"}
              </Button>
              <Button type="button" variant="outline" onClick={handleReset}>
                Reset
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {error ? (
        <Card className="mb-6 border-destructive/40">
          <CardHeader>
            <CardTitle className="text-base text-destructive">Error</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {loading && items.length === 0 ? (
        <p className="text-muted-foreground">Loading timeline…</p>
      ) : null}

      {!loading && items.length === 0 && !error ? (
        <p className="text-muted-foreground">
          No entries match your filters yet.
        </p>
      ) : null}

      <ul className="space-y-4">
        {items.map((item) => {
          const summary = payloadSummary(item.payload);
          return (
            <li key={item.id}>
              <Card>
                <CardHeader className="flex flex-row items-start gap-4 space-y-0 pb-2">
                  {item.asset?.asset_type === "image" &&
                  item.asset_id &&
                  item.primary_version ? (
                    <div className="size-16 shrink-0 overflow-hidden rounded-md bg-muted">
                      <img
                        src={assetFileUrl(item.asset_id)}
                        alt=""
                        className="size-full object-cover"
                      />
                    </div>
                  ) : null}
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
                        {item.kind}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatWhen(item.occurred_at)}
                      </span>
                    </div>
                    <CardTitle className="text-base leading-snug">
                      {item.asset?.title ??
                        (item.asset_id
                          ? `Asset ${item.asset_id.slice(0, 8)}…`
                          : "Timeline entry")}
                    </CardTitle>
                    {item.asset ? (
                      <CardDescription>
                        {item.asset.asset_type}
                        {item.asset.permission_scope
                          ? ` · ${item.asset.permission_scope}`
                          : ""}
                      </CardDescription>
                    ) : null}
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {summary ? (
                    <p className="text-muted-foreground">{summary}</p>
                  ) : null}
                  {item.primary_version ? (
                    <p className="text-xs text-muted-foreground">
                      {item.primary_version.mime_type}
                      {item.primary_version.width != null &&
                      item.primary_version.height != null
                        ? ` · ${item.primary_version.width}×${item.primary_version.height}`
                        : ""}
                      {item.primary_version.duration_ms != null
                        ? ` · ${Math.round(item.primary_version.duration_ms / 1000)}s`
                        : ""}
                    </p>
                  ) : null}
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ul>

      {items.length > 0 && hasMore ? (
        <div className="mt-6 flex justify-center">
          <Button
            type="button"
            variant="secondary"
            disabled={loadingMore}
            onClick={() => void handleLoadMore()}
          >
            {loadingMore ? "Loading…" : "Load more"}
          </Button>
        </div>
      ) : null}
    </main>
  );
}
