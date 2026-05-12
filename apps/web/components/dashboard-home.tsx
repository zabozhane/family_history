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
import { AssetVideoThumb } from "@/components/asset-video-thumb";
import { GalleryLightbox } from "@/components/gallery-lightbox";
import { useMusicPlayer } from "@/components/music-player-context";
import { ApiRequestError, apiFetch, buildAssetsListPath } from "@/lib/api";
import { useWorkspace } from "@/components/workspace-context";
import type { AssetRead } from "@/lib/types";
import { cn, uploadedByDisplayName } from "@/lib/utils";

/** Playlist order: media in the selected month by timeline instant, newest first. */
const FETCH_LIMIT = 200;

function formatDuration(ms: number | null | undefined): string | null {
  if (ms == null || ms <= 0) return null;
  const totalSec = Math.round(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

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

const MONTH_INDEXES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as const;

type MediaFilter = "all" | "image" | "video" | "audio";

function DashboardMusicList({
  tracks,
  onRowClick,
  currentTrackId,
  playing,
  playerVisible,
}: {
  tracks: AssetRead[];
  onRowClick: (index: number) => void;
  currentTrackId: string | undefined;
  playing: boolean;
  playerVisible: boolean;
}) {
  if (tracks.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No tracks this month.{" "}
        <Link href="/music" className="font-medium text-primary underline">
          Music library
        </Link>
      </p>
    );
  }
  return (
    <ul className="space-y-1.5">
      {tracks.map((asset, index) => {
        const duration = formatDuration(asset.primary_version?.duration_ms);
        const isThisTrack = playerVisible && currentTrackId === asset.id;
        return (
          <li key={asset.id}>
            <Card className="rounded-md shadow-none">
              <CardHeader className="flex flex-row items-center gap-3 space-y-0 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <CardTitle className="text-sm font-semibold leading-tight">
                    {asset.title ?? "Untitled track"}
                  </CardTitle>
                  <CardDescription className="mt-0.5 line-clamp-2 text-xs leading-tight">
                    {asset.description?.trim() ||
                      (duration
                        ? `Duration ${duration} · ${uploadedByDisplayName(asset)}`
                        : `Uploaded by ${uploadedByDisplayName(asset)}`)}
                  </CardDescription>
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  <Button
                    type="button"
                    size="icon"
                    variant={isThisTrack ? "default" : "secondary"}
                    className="h-8 w-8 rounded-full"
                    aria-label={isThisTrack && playing ? "Пауза" : "Воспроизвести"}
                    onClick={() => onRowClick(index)}
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
  );
}

export function DashboardHome() {
  const { ready, activeWorkspaceId } = useWorkspace();

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
    if (!ready) return;
    if (!activeWorkspaceId) {
      setAssets([]);
      setLoading(false);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiFetch<AssetRead[]>(
      buildAssetsListPath(FETCH_LIMIT, activeWorkspaceId),
    )
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
  }, [ready, activeWorkspaceId]);

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
    return [];
  }, [mediaFilter, imagesInRange, videosInRange]);

  /** Lightbox order matches UI: for All, photos then videos (same row-major expectation). */
  const lightboxAssets = useMemo(() => {
    if (mediaFilter === "audio") return [];
    if (mediaFilter === "all") return [...imagesInRange, ...videosInRange];
    return visualForFilter;
  }, [mediaFilter, imagesInRange, videosInRange, visualForFilter]);

  useEffect(() => {
    if (lightboxIndex === null) return;
    if (mediaFilter === "audio") {
      setLightboxIndex(null);
      return;
    }
    if (lightboxAssets.length === 0) {
      setLightboxIndex(null);
      return;
    }
    if (lightboxIndex >= lightboxAssets.length) {
      setLightboxIndex(lightboxAssets.length - 1);
    }
  }, [lightboxAssets, lightboxIndex, mediaFilter]);

  if (!ready || loading) {
    return (
      <div className="flex flex-1 flex-col px-6 py-10">
        <p className="text-muted-foreground">Loading your library…</p>
      </div>
    );
  }

  if (!activeWorkspaceId) {
    return (
      <div className="flex flex-1 flex-col px-6 py-10">
        <Card className="max-w-lg">
          <CardHeader>
            <CardTitle>No workspace</CardTitle>
            <CardDescription>
              Create a library using <strong className="font-medium">+</strong> in the sidebar,
              or refresh the page.
            </CardDescription>
          </CardHeader>
        </Card>
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

  const monthHasNothing =
    imagesInRange.length === 0 &&
    videosInRange.length === 0 &&
    audioInRange.length === 0;

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
            Pick a month (local calendar). Need events?{" "}
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
            className="rounded-lg border border-border bg-muted/40 p-1 shadow-sm"
            role="tablist"
            aria-labelledby="month-bar-label"
          >
            <div className="grid grid-cols-6 gap-1 sm:grid-cols-12">
              {MONTH_INDEXES.map((mi) => {
                const selected = mi === selectedMonthIndex;
                const label = monthLabels[mi];
                const shortLabel = monthShortFmt.format(new Date(selectedYear, mi, 1));

                return (
                  <button
                    key={mi}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    aria-label={`${selectedYear} ${label}`}
                    title={`${selectedYear} ${label}`}
                    onClick={() => setSelectedMonthIndex(mi)}
                    className={cn(
                      "min-h-[2rem] rounded-md px-1 py-1.5 text-center text-[10px] font-semibold uppercase tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:min-h-0 sm:py-2 sm:text-[11px]",
                      selected
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-muted/80 hover:text-foreground",
                    )}
                  >
                    <span className="pointer-events-none block truncate">{shortLabel}</span>
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
          assets={lightboxAssets}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onIndexChange={setLightboxIndex}
        />

        {mediaFilter === "audio" ? (
          <>
            <DashboardMusicList
              tracks={audioInRange}
              onRowClick={onTimelineMusicRowClick}
              currentTrackId={currentTrack?.id}
              playing={playing}
              playerVisible={playerVisible}
            />
            {audioInRange.length > 0 ? (
              <p className="mt-3 text-xs text-muted-foreground">
                Playback uses the same bottom player as{" "}
                <Link href="/music" className="font-medium text-primary underline">
                  Music
                </Link>
                .
              </p>
            ) : null}
          </>
        ) : null}

        {mediaFilter === "all" ? (
          monthHasNothing ? (
            <p className="text-sm text-muted-foreground">
              Nothing in this month (photos, videos, or tracks).{" "}
              <Link href="/gallery" className="font-medium text-primary underline">
                Gallery
              </Link>
              {" · "}
              <Link href="/video" className="font-medium text-primary underline">
                Videos
              </Link>
              {" · "}
              <Link href="/music" className="font-medium text-primary underline">
                Music
              </Link>
            </p>
          ) : (
            <>
              <div className="flex flex-col gap-6 lg:flex-row lg:items-stretch lg:gap-8">
              <div className="flex min-w-0 flex-1 flex-col gap-8">
                <div>
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Photo
                  </h4>
                  {imagesInRange.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No photos in this month.{" "}
                      <Link href="/gallery" className="font-medium text-primary underline">
                        Gallery
                      </Link>
                    </p>
                  ) : (
                    <ul className="grid grid-cols-4 gap-1.5 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7 xl:grid-cols-8">
                      {imagesInRange.map((asset, i) => (
                        <li key={asset.id}>
                          <button
                            type="button"
                            className="group w-full overflow-hidden rounded-md border border-border bg-card text-left shadow-sm outline-none ring-offset-background transition hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring"
                            onClick={() => setLightboxIndex(i)}
                          >
                            <div className="aspect-square bg-muted">
                              <AssetImageThumb
                                assetId={asset.id}
                                alt={asset.title ?? "Photo"}
                              />
                            </div>
                            <div className="px-1 py-1">
                              <p className="truncate text-[10px] font-medium leading-tight text-muted-foreground group-hover:text-foreground">
                                {asset.title ?? "Untitled"}
                              </p>
                              <p className="truncate text-[9px] leading-tight text-muted-foreground/90">
                                {uploadedByDisplayName(asset)}
                              </p>
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Video
                  </h4>
                  {videosInRange.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No videos in this month.{" "}
                      <Link href="/video" className="font-medium text-primary underline">
                        Videos
                      </Link>
                    </p>
                  ) : (
                    <ul className="grid grid-cols-4 gap-1.5 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7 xl:grid-cols-8">
                      {videosInRange.map((asset, j) => (
                        <li key={asset.id}>
                          <button
                            type="button"
                            className="group w-full overflow-hidden rounded-md border border-border bg-card text-left shadow-sm outline-none ring-offset-background transition hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring"
                            onClick={() =>
                              setLightboxIndex(imagesInRange.length + j)
                            }
                          >
                            <div className="aspect-square bg-muted">
                              <AssetVideoThumb
                                assetId={asset.id}
                                alt={asset.title ?? "Video"}
                              />
                            </div>
                            <div className="px-1 py-1">
                              <p className="truncate text-[10px] font-medium leading-tight text-muted-foreground group-hover:text-foreground">
                                {asset.title ?? "Untitled"}
                              </p>
                              <p className="truncate text-[9px] leading-tight text-muted-foreground/90">
                                {uploadedByDisplayName(asset)}
                              </p>
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
              <aside className="flex min-h-0 shrink-0 flex-col gap-2 lg:w-[min(280px,30vw)] lg:border-l lg:border-border lg:pl-6">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Music
                </h4>
                <div className="min-h-0 lg:max-h-[min(calc(100dvh-12rem),56rem)] lg:overflow-y-auto lg:pr-1">
                  <DashboardMusicList
                    tracks={audioInRange}
                    onRowClick={onTimelineMusicRowClick}
                    currentTrackId={currentTrack?.id}
                    playing={playing}
                    playerVisible={playerVisible}
                  />
                </div>
              </aside>
              </div>
              {audioInRange.length > 0 ? (
                <p className="mt-4 text-xs text-muted-foreground">
                  Playback uses the same bottom player as{" "}
                  <Link href="/music" className="font-medium text-primary underline">
                    Music
                  </Link>
                  .
                </p>
              ) : null}
            </>
          )
        ) : null}

        {mediaFilter === "image" || mediaFilter === "video" ? (
          <>
            {visualForFilter.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {mediaFilter === "image"
                  ? "No photos in this month."
                  : "No videos in this month."}{" "}
                {mediaFilter === "video" ? (
                  <Link href="/video" className="font-medium text-primary underline">
                    Videos
                  </Link>
                ) : (
                  <Link href="/gallery" className="font-medium text-primary underline">
                    Gallery
                  </Link>
                )}
              </p>
            ) : null}
            {visualForFilter.length > 0 ? (
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
                          <AssetVideoThumb
                            assetId={asset.id}
                            alt={asset.title ?? "Video"}
                          />
                        )}
                      </div>
                      <div className="px-1 py-1">
                        <p className="truncate text-[10px] font-medium leading-tight text-muted-foreground group-hover:text-foreground">
                          {asset.title ?? "Untitled"}
                        </p>
                        <p className="truncate text-[9px] leading-tight text-muted-foreground/90">
                          {uploadedByDisplayName(asset)}
                        </p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        ) : null}
      </section>
    </div>
  );
}
