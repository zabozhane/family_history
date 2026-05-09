"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import Link from "next/link";
import { Pause, Play } from "lucide-react";

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AssetImageThumb } from "@/components/asset-image-thumb";
import { GalleryLightbox } from "@/components/gallery-lightbox";
import { useMusicPlayer } from "@/components/music-player-context";
import { ApiRequestError, apiFetch } from "@/lib/api";
import { assetFileUrl } from "@/lib/media-url";
import type { AssetRead } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Playlist order: media in the selected month by timeline instant, newest first. */
const FETCH_LIMIT = 200;

function formatDuration(ms: number | null | undefined): string | null {
  if (ms == null || ms <= 0) return null;
  const totalSec = Math.round(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Horizontal overlap between chevron segments (px) — smaller = sleeker strip */
const CHEVRON_NOTCH_PX = 8;

/** Local calendar bounds for [year, monthIndex]. */
function localMonthRange(year: number, monthIndex: number): { start: Date; end: Date } {
  const start = new Date(year, monthIndex, 1, 0, 0, 0, 0);
  const end = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

function parseInstant(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function inRange(d: Date, start: Date, end: Date): boolean {
  return d >= start && d <= end;
}

/** Capture date when set; otherwise upload time (`created_at`). */
function timelineInstant(asset: AssetRead): Date | null {
  return parseInstant(asset.captured_at) ?? parseInstant(asset.created_at);
}

/** Distinct calendar years from image/video/audio timeline instants, newest first. */
function yearsFromAssets(assets: AssetRead[]): number[] {
  const ys = new Set<number>();
  for (const a of assets) {
    if (a.asset_type !== "image" && a.asset_type !== "audio" && a.asset_type !== "video") {
      continue;
    }
    const t = timelineInstant(a);
    if (t) ys.add(t.getFullYear());
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
    "text-white shadow-sm transition-[filter,transform] hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-white/90",
    season,
    selected && "z-30 brightness-110 shadow-[inset_0_-3px_0_0_rgba(255,255,255,0.92)]",
  );
}

const MONTH_INDEXES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as const;

type MediaFilter = "all" | "image" | "video" | "audio";

function VideoThumb({ assetId, alt }: { assetId: string; alt: string }) {
  return (
    <video
      src={assetFileUrl(assetId)}
      className="h-full w-full object-cover"
      muted
      playsInline
      preload="metadata"
      aria-label={alt}
    />
  );
}

export function DashboardHome() {
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  const [selectedMonthIndex, setSelectedMonthIndex] = useState(() => new Date().getMonth());

  const [assets, setAssets] = useState<AssetRead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mediaFilter, setMediaFilter] = useState<MediaFilter>("all");
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const monthLongFmt = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        month: "long",
      }),
    [],
  );

  const monthShortFmt = useMemo(
    () => new Intl.DateTimeFormat(undefined, { month: "short" }),
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

  const assetsInMonth = useMemo(() => {
    const { rangeStart, rangeEnd } = selectedMonthRange;
    const rows: AssetRead[] = [];
    for (const a of assets) {
      if (a.asset_type !== "image" && a.asset_type !== "video" && a.asset_type !== "audio") {
        continue;
      }
      const t = timelineInstant(a);
      if (!t || !inRange(t, rangeStart, rangeEnd)) continue;
      rows.push(a);
    }
    const byTimelineDesc = (x: AssetRead, y: AssetRead) => {
      const dx = timelineInstant(x)?.getTime() ?? 0;
      const dy = timelineInstant(y)?.getTime() ?? 0;
      return dy - dx;
    };
    rows.sort(byTimelineDesc);
    return rows;
  }, [assets, selectedMonthRange]);

  const imagesInRange = useMemo(
    () => assetsInMonth.filter((a) => a.asset_type === "image"),
    [assetsInMonth],
  );
  const videosInRange = useMemo(
    () => assetsInMonth.filter((a) => a.asset_type === "video"),
    [assetsInMonth],
  );
  const audioInRange = useMemo(
    () => assetsInMonth.filter((a) => a.asset_type === "audio"),
    [assetsInMonth],
  );

  const {
    queue,
    playerVisible,
    playing,
    currentTrack,
    togglePlay,
    loadQueueAndPlay,
  } = useMusicPlayer();

  const onTimelineMusicRowClick = useCallback(
    (index: number) => {
      const track = audioInRange[index];
      if (!track) return;
      const sameListAsShown =
        queue.length === audioInRange.length &&
        queue.every((t, i) => t.id === audioInRange[i]?.id);
      if (
        sameListAsShown &&
        playerVisible &&
        currentTrack?.id === track.id
      ) {
        togglePlay();
        return;
      }
      loadQueueAndPlay(audioInRange, index);
    },
    [
      audioInRange,
      queue,
      playerVisible,
      currentTrack?.id,
      togglePlay,
      loadQueueAndPlay,
    ],
  );

  const visualForFilter = useMemo(() => {
    if (mediaFilter === "image") return imagesInRange;
    if (mediaFilter === "video") return videosInRange;
    if (mediaFilter === "all") {
      return assetsInMonth.filter(
        (a) => a.asset_type === "image" || a.asset_type === "video",
      );
    }
    return [];
  }, [mediaFilter, imagesInRange, videosInRange, assetsInMonth]);

  useEffect(() => {
    if (lightboxIndex === null) return;
    if (mediaFilter === "audio") {
      setLightboxIndex(null);
      return;
    }
    if (visualForFilter.length === 0) {
      setLightboxIndex(null);
      return;
    }
    if (lightboxIndex >= visualForFilter.length) {
      setLightboxIndex(visualForFilter.length - 1);
    }
  }, [visualForFilter, lightboxIndex, mediaFilter]);

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

  const hasTimelineYears = yearsWithData.length > 0;

  const showGrid = mediaFilter !== "audio";

  const FILTER_TABS: { id: MediaFilter; label: string }[] = [
    { id: "image", label: "Photo" },
    { id: "video", label: "Video" },
    { id: "audio", label: "Music" },
    { id: "all", label: "All" },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <section
        id="dashboard-timeline"
        className="scroll-mt-4 shrink-0 border-b border-border bg-muted/20 px-4 py-6 md:px-6"
      >
        <div className="mb-4">
          <h2 className="text-lg font-semibold tracking-tight">Timeline</h2>
          <p className="mt-1 max-w-xl text-xs text-muted-foreground">
            Photos, videos, and tracks are grouped by capture date when set; otherwise by upload
            time. Years listed here have at least one image, video, or audio file in that year.
            Pick a month on the strip (local calendar). Need events?{" "}
            <Link href="/timeline" className="font-medium text-primary underline">
              Full timeline
            </Link>
            .
          </p>
          {!hasTimelineYears ? (
            <p className="mt-2 max-w-xl text-xs text-amber-700 dark:text-amber-500">
              No photos, video, or music in your library yet — only the current year is shown.
              Upload media from the sidebar to populate the timeline.
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

        <div className="space-y-1">
          <p className="sr-only" id="month-bar-label">
            Select month for {selectedYear}
          </p>
          <div
            className="overflow-x-auto overflow-y-visible pb-1 pt-0 [-ms-overflow-style:none] [scrollbar-width:thin] md:[scrollbar-width:none]"
            role="tablist"
            aria-labelledby="month-bar-label"
          >
            <div className="flex min-w-[520px] items-stretch md:min-w-0">
              {MONTH_INDEXES.map((mi) => {
                const selected = mi === selectedMonthIndex;
                const label = monthLabels[mi];
                const shortLabel = monthShortFmt.format(new Date(selectedYear, mi, 1));
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
                      zIndex: selected ? 30 : mi + 1,
                    }}
                    className={cn(
                      "relative min-h-[2rem] min-w-0 flex-1 px-1 py-1 text-center sm:min-h-[2.25rem]",
                      monthChevronStyle(mi, selected),
                    )}
                  >
                    <span className="pointer-events-none flex flex-row items-center justify-center gap-0.5 leading-none sm:flex-col sm:gap-0.5">
                      <span className="max-w-[95%] truncate text-[9px] font-semibold opacity-95 sm:text-[10px]">
                        {shortLabel}
                      </span>
                      <span className="select-none text-xs sm:text-sm" aria-hidden>
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
        <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-2 border-b border-border pb-3">
          <h3 className="text-base font-semibold tracking-tight text-foreground">
            {monthLabels[selectedMonthIndex]} {selectedYear}
          </h3>
          <div
            className="flex flex-wrap items-center gap-1"
            role="tablist"
            aria-label="Media in this month"
          >
            {FILTER_TABS.map(({ id, label }) => {
              const selected = mediaFilter === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setMediaFilter(id)}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide transition-colors",
                    selected
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <GalleryLightbox
          assets={mediaFilter === "audio" ? [] : visualForFilter}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onIndexChange={setLightboxIndex}
        />

        {mediaFilter === "audio" ? (
          audioInRange.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No audio in this month.{" "}
              <Link href="/music" className="font-medium text-primary underline">
                Music library
              </Link>
            </p>
          ) : (
            <>
              <ul className="space-y-1.5">
                {audioInRange.map((asset, index) => {
                  const duration = formatDuration(asset.primary_version?.duration_ms);
                  const isThisTrack =
                    playerVisible && currentTrack?.id === asset.id;
                  return (
                    <li key={asset.id}>
                      <Card className="rounded-md shadow-none">
                        <CardHeader className="flex flex-row items-center gap-3 space-y-0 px-3 py-2">
                          <div className="min-w-0 flex-1">
                            <CardTitle className="text-sm font-semibold leading-tight">
                              {asset.title ?? "Untitled track"}
                            </CardTitle>
                            <CardDescription className="mt-0.5 line-clamp-1 text-xs leading-tight">
                              {asset.description ??
                                (duration ? `Duration ${duration}` : "Audio")}
                            </CardDescription>
                          </div>
                          <div className="flex shrink-0 items-center gap-0.5">
                            <Button
                              type="button"
                              size="icon"
                              variant={isThisTrack ? "default" : "secondary"}
                              className="h-8 w-8 rounded-full"
                              aria-label={
                                isThisTrack && playing ? "Пауза" : "Воспроизвести"
                              }
                              onClick={() => onTimelineMusicRowClick(index)}
                            >
                              {isThisTrack && playing ? (
                                <Pause className="h-3.5 w-3.5" />
                              ) : (
                                <Play className="h-3.5 w-3.5 fill-current" />
                              )}
                            </Button>
                          </div>
                        </CardHeader>
                      </Card>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-3 text-xs text-muted-foreground">
                Playback uses the same bottom player as{" "}
                <Link href="/music" className="font-medium text-primary underline">
                  Music
                </Link>
                .
              </p>
            </>
          )
        ) : null}

        {showGrid && visualForFilter.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {mediaFilter === "image"
              ? "No photos in this month."
              : mediaFilter === "video"
                ? "No videos in this month."
                : mediaFilter === "all"
                  ? "No photos or videos in this month (by capture date, or upload date if none)."
                  : null}{" "}
            <Link href="/gallery" className="font-medium text-primary underline">
              Gallery
            </Link>
          </p>
        ) : null}

        {showGrid && visualForFilter.length > 0 ? (
          <ul className="grid grid-cols-4 gap-1.5 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-9 xl:grid-cols-10">
            {visualForFilter.map((asset, i) => (
              <li key={asset.id}>
                <button
                  type="button"
                  className="group w-full overflow-hidden rounded-md border border-border bg-card text-left shadow-sm outline-none ring-offset-background transition hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => setLightboxIndex(i)}
                >
                  <div className="aspect-square bg-muted">
                    {asset.asset_type === "image" ? (
                      <AssetImageThumb
                        assetId={asset.id}
                        alt={asset.title ?? "Photo"}
                      />
                    ) : (
                      <VideoThumb
                        assetId={asset.id}
                        alt={asset.title ?? "Video"}
                      />
                    )}
                  </div>
                  <p className="truncate px-1 py-1 text-[10px] font-medium leading-tight text-muted-foreground group-hover:text-foreground">
                    {asset.title ?? "Untitled"}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}
