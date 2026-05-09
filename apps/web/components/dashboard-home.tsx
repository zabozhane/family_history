"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ApiRequestError, apiFetch } from "@/lib/api";
import { assetFileUrl } from "@/lib/media-url";
import type { AssetRead } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Playlist order: audio with `captured_at` in the selected month, newest first (`captured_at` desc). */
const FETCH_LIMIT = 200;

/** Horizontal overlap between chevron segments (px). */
const CHEVRON_NOTCH_PX = 14;

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

/** Local calendar bounds for [year, monthIndex]. */
function localMonthRange(year: number, monthIndex: number): { start: Date; end: Date } {
  const start = new Date(year, monthIndex, 1, 0, 0, 0, 0);
  const end = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

function parseCapturedAt(raw: string | null): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function inRange(d: Date, start: Date, end: Date): boolean {
  return d >= start && d <= end;
}

/** Distinct calendar years from any asset that has `captured_at`, newest first. */
function yearsFromAssets(assets: AssetRead[]): number[] {
  const ys = new Set<number>();
  for (const a of assets) {
    const cd = parseCapturedAt(a.captured_at);
    if (cd) ys.add(cd.getFullYear());
  }
  return Array.from(ys).sort((a, b) => b - a);
}

function chevronClipPath(position: "first" | "mid" | "last"): string {
  const n = CHEVRON_NOTCH_PX;
  if (position === "first") {
    return `polygon(0 0, calc(100% - ${n}px) 0, 100% 50%, calc(100% - ${n}px) 100%, 0 100%)`;
  }
  if (position === "last") {
    return `polygon(${n}px 0, 100% 0, 100% 100%, ${n}px 100%, 0 50%)`;
  }
  return `polygon(${n}px 0, calc(100% - ${n}px) 0, 100% 50%, calc(100% - ${n}px) 100%, 0 100%, ${n}px 50%)`;
}

/** Seasonal vibe + emoji per calendar month (local month index 0 = January). */
function monthEmoji(monthIndex: number): string {
  const emojis = ["❄️", "❄️", "🌱", "🌷", "🌿", "☀️", "☀️", "🌻", "🍂", "🍂", "🍁", "❄️"];
  return emojis[monthIndex] ?? "📅";
}

function monthChevronStyle(monthIndex: number, selected: boolean): string {
  const winter = "bg-gradient-to-b from-sky-600 to-cyan-800";
  const spring = "bg-gradient-to-b from-emerald-600 to-teal-700";
  const summer = "bg-gradient-to-b from-amber-500 to-orange-600";
  const autumn = "bg-gradient-to-b from-orange-700 to-red-900";
  let season = winter;
  if ([2, 3, 4].includes(monthIndex)) season = spring;
  else if ([5, 6, 7].includes(monthIndex)) season = summer;
  else if ([8, 9, 10].includes(monthIndex)) season = autumn;

  return cn(
    "text-white shadow-md transition-[filter,transform] hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-white/90",
    season,
    selected && "brightness-110 ring-2 ring-white ring-inset",
  );
}

const MONTH_INDEXES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as const;

export function DashboardHome() {
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  const [selectedMonthIndex, setSelectedMonthIndex] = useState(() => new Date().getMonth());

  const [assets, setAssets] = useState<AssetRead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [audioIndex, setAudioIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const monthLongFmt = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        month: "long",
      }),
    [],
  );

  const yearsWithData = useMemo(() => yearsFromAssets(assets), [assets]);

  const yearOptions = useMemo(() => {
    if (yearsWithData.length > 0) return yearsWithData;
    return [new Date().getFullYear()];
  }, [yearsWithData]);

  useEffect(() => {
    if (yearOptions.length === 0) return;
    if (!yearOptions.includes(selectedYear)) {
      setSelectedYear(yearOptions[0] ?? new Date().getFullYear());
    }
  }, [yearOptions, selectedYear]);

  const monthLabels = useMemo(() => {
    return MONTH_INDEXES.map((mi) => {
      const d = new Date(selectedYear, mi, 1);
      return monthLongFmt.format(d);
    });
  }, [monthLongFmt, selectedYear]);

  const selectedMonthRange = useMemo(() => {
    const { start, end } = localMonthRange(selectedYear, selectedMonthIndex);
    return { rangeStart: start, rangeEnd: end };
  }, [selectedYear, selectedMonthIndex]);

  useEffect(() => {
    let cancelled = false;
    apiFetch<AssetRead[]>(`/api/v1/assets?limit=${FETCH_LIMIT}`)
      .then((rows) => {
        if (!cancelled) setAssets(rows);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof ApiRequestError
              ? err.message
              : err instanceof Error
                ? err.message
                : "Failed to load media",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const { imagesInRange, audioInRange } = useMemo(() => {
    const { rangeStart, rangeEnd } = selectedMonthRange;
    const images: AssetRead[] = [];
    const audio: AssetRead[] = [];
    for (const a of assets) {
      if (a.asset_type !== "image" && a.asset_type !== "audio") continue;
      const cd = parseCapturedAt(a.captured_at);
      if (!cd || !inRange(cd, rangeStart, rangeEnd)) continue;
      if (a.asset_type === "image") images.push(a);
      else audio.push(a);
    }
    const byCapturedDesc = (x: AssetRead, y: AssetRead) => {
      const dx = parseCapturedAt(x.captured_at)?.getTime() ?? 0;
      const dy = parseCapturedAt(y.captured_at)?.getTime() ?? 0;
      return dy - dx;
    };
    images.sort(byCapturedDesc);
    audio.sort(byCapturedDesc);
    return { imagesInRange: images, audioInRange: audio };
  }, [assets, selectedMonthRange]);

  useEffect(() => {
    setAudioIndex(0);
    setPlaying(false);
    const el = audioRef.current;
    if (el) {
      el.pause();
      el.currentTime = 0;
    }
  }, [selectedYear, selectedMonthIndex]);

  useEffect(() => {
    if (audioIndex >= audioInRange.length) {
      setAudioIndex(Math.max(0, audioInRange.length - 1));
    }
  }, [audioInRange, audioIndex]);

  const currentTrack = audioInRange[audioIndex];

  const goTrack = useCallback(
    (delta: number) => {
      const len = audioInRange.length;
      if (len === 0) return;
      setAudioIndex((i) => (i + delta + len) % len);
      setPlaying(false);
    },
    [audioInRange.length],
  );

  const togglePlay = useCallback(() => {
    const el = audioRef.current;
    if (!el || !currentTrack?.primary_version) return;
    if (el.paused) void el.play();
    else el.pause();
  }, [currentTrack?.primary_version]);

  useEffect(() => {
    setPlaying(false);
  }, [currentTrack?.id]);

  if (loading) {
    return (
      <div className="flex flex-1 flex-col px-6 py-10">
        <p className="text-muted-foreground">Loading your library…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 flex-col px-6 py-10">
        <Card className="max-w-lg border-destructive/40">
          <CardHeader>
            <CardTitle>Could not load dashboard</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const selectionKey = `${selectedYear}-${pad2(selectedMonthIndex + 1)}`;
  const hasDatedUploads = yearsWithData.length > 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <section
        id="dashboard-timeline"
        className="scroll-mt-4 shrink-0 border-b border-border bg-muted/20 px-4 py-6 md:px-6"
      >
        <div className="mb-4">
          <h2 className="text-lg font-semibold tracking-tight">Timeline</h2>
          <p className="mt-1 max-w-xl text-xs text-muted-foreground">
            Years listed here have at least one item with a{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-[10px]">
              captured_at
            </code>{" "}
            date. Pick a month on the chevron bar (local calendar). Need events?{" "}
            <Link href="/timeline" className="font-medium text-primary underline">
              Full timeline
            </Link>
            .
          </p>
          {!hasDatedUploads ? (
            <p className="mt-2 max-w-xl text-xs text-amber-700 dark:text-amber-500">
              No dated uploads in your library yet — only the current year is shown. Add a capture
              date when uploading so years appear here.
            </p>
          ) : null}
        </div>

        <div
          className="mb-5 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="tablist"
          aria-label="Year"
        >
          {yearOptions.map((y) => {
            const selected = y === selectedYear;
            return (
              <button
                key={y}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setSelectedYear(y)}
                className={cn(
                  "shrink-0 min-w-[4rem] rounded-md border px-3 py-2 text-sm font-semibold tabular-nums transition-colors",
                  selected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                )}
              >
                {y}
              </button>
            );
          })}
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground" id="month-bar-label">
            Month — {selectionKey}
          </p>
          <div
            className="overflow-x-auto overflow-y-visible pb-2 pt-1 [-ms-overflow-style:none] [scrollbar-width:thin] md:[scrollbar-width:none]"
            role="tablist"
            aria-labelledby="month-bar-label"
          >
            <div className="flex min-w-[640px] items-stretch md:min-w-0">
              {MONTH_INDEXES.map((mi) => {
                const selected = mi === selectedMonthIndex;
                const label = monthLabels[mi];
                const emoji = monthEmoji(mi);
                const position =
                  mi === 0 ? "first" : mi === 11 ? "last" : "mid";
                const overlap =
                  mi === 0 ? 0 : -(CHEVRON_NOTCH_PX - 1);

                return (
                  <button
                    key={mi}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    aria-label={`${label} ${emoji}`}
                    title={`${selectedYear} ${label}`}
                    onClick={() => setSelectedMonthIndex(mi)}
                    style={{
                      clipPath: chevronClipPath(position),
                      marginLeft: overlap,
                      zIndex: selected ? 40 : mi + 1,
                    }}
                    className={cn(
                      "relative min-h-[4rem] min-w-0 flex-1 px-2 py-2 text-center sm:min-h-[3.75rem]",
                      monthChevronStyle(mi, selected),
                    )}
                  >
                    <span className="pointer-events-none flex flex-col items-center justify-center gap-0.5 leading-tight">
                      <span className="max-w-[90%] truncate text-[10px] font-semibold leading-snug opacity-95 sm:text-xs">
                        {label}
                      </span>
                      <span className="select-none text-lg sm:text-xl" aria-hidden>
                        {emoji}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="min-h-0 flex-1 overflow-y-auto px-4 py-6 md:px-6">
        <h3 className="mb-4 text-sm font-medium text-muted-foreground">
          Photos in this period
        </h3>
        {imagesInRange.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No dated photos in this month (images need{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">
              captured_at
            </code>
            ).{" "}
            <Link href="/gallery" className="font-medium text-primary underline">
              All photos
            </Link>
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {imagesInRange.map((asset) => (
              <li key={asset.id}>
                <Card className="overflow-hidden py-0">
                  <div className="aspect-square bg-muted">
                    {asset.primary_version ? (
                      <img
                        src={assetFileUrl(asset.id)}
                        alt={asset.title ?? "Photo"}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center p-2 text-center text-xs text-muted-foreground">
                        No file
                      </div>
                    )}
                  </div>
                  <CardContent className="p-2">
                    <p className="truncate text-xs font-medium">
                      {asset.title ?? "Untitled"}
                    </p>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <footer className="shrink-0 border-t border-border bg-background px-4 py-4 md:px-6">
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Music player
        </h3>
        {audioInRange.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No dated audio in this month.{" "}
            <Link href="/music" className="font-medium text-primary underline">
              Music library
            </Link>
          </p>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => goTrack(-1)}
                disabled={audioInRange.length <= 1}
              >
                Previous
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={togglePlay}
                disabled={!currentTrack?.primary_version}
              >
                {playing ? "Pause" : "Play"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => goTrack(1)}
                disabled={audioInRange.length <= 1}
              >
                Next
              </Button>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {currentTrack?.title ?? "Track"}
              </p>
              <p className="text-xs text-muted-foreground">
                {audioIndex + 1} / {audioInRange.length}
                {" · "}
                Order: newest capture date first
              </p>
              {currentTrack?.primary_version ? (
                <audio
                  ref={audioRef}
                  key={currentTrack.id}
                  className="mt-2 h-9 w-full max-w-md"
                  controls
                  src={assetFileUrl(currentTrack.id)}
                  preload="metadata"
                  onPlay={() => setPlaying(true)}
                  onPause={() => setPlaying(false)}
                  onEnded={() => goTrack(1)}
                />
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">No audio file</p>
              )}
            </div>
          </div>
        )}
      </footer>
    </div>
  );
}
