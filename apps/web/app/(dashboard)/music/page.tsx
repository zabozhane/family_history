"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Pause, Play, Trash2 } from "lucide-react";

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  MusicPlayerBar,
  type RepeatMode,
} from "@/components/music-player-bar";
import { MusicUploadForm } from "@/components/music-upload-form";
import { ApiRequestError, apiDeleteAsset, apiFetch } from "@/lib/api";
import { assetFileUrl } from "@/lib/media-url";
import type { AssetRead } from "@/lib/types";

function formatDuration(ms: number | null | undefined): string | null {
  if (ms == null || ms <= 0) return null;
  const totalSec = Math.round(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Newest on timeline first (`captured_at` or `created_at`). */
function timelineMs(asset: AssetRead): number {
  if (asset.captured_at) {
    const t = new Date(asset.captured_at).getTime();
    if (!Number.isNaN(t)) return t;
  }
  return new Date(asset.created_at).getTime();
}

function sortAudioTracks(rows: AssetRead[]): AssetRead[] {
  return [...rows]
    .filter((a) => a.asset_type === "audio")
    .sort((a, b) => timelineMs(b) - timelineMs(a));
}

export default function MusicPage() {
  const [assets, setAssets] = useState<AssetRead[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [playerVisible, setPlayerVisible] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [playGeneration, setPlayGeneration] = useState(0);
  const [shuffle, setShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>("off");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pendingPlayRef = useRef(false);

  const reloadAssets = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    setError(null);
    try {
      const rows = await apiFetch<AssetRead[]>("/api/v1/assets?limit=200");
      const sorted = sortAudioTracks(rows);
      setAssets(sorted);
      return sorted;
    } catch (err) {
      if (!opts?.silent) {
        setError(
          err instanceof ApiRequestError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Failed to load tracks",
        );
      }
      return [];
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reloadAssets();
  }, [reloadAssets]);

  const currentTrack = assets[currentIndex] ?? null;

  useEffect(() => {
    if (assets.length === 0) {
      setPlayerVisible(false);
      setCurrentIndex(0);
      return;
    }
    setCurrentIndex((i) => Math.min(i, assets.length - 1));
  }, [assets]);

  useEffect(() => {
    const el = audioRef.current;
    if (el) el.loop = repeatMode === "one";
  }, [repeatMode, currentTrack?.id]);

  useEffect(() => {
    if (!pendingPlayRef.current || !playerVisible || !currentTrack) return;
    pendingPlayRef.current = false;
    void audioRef.current?.play().catch(() => {});
  }, [currentIndex, playerVisible, currentTrack?.id, playGeneration]);

  const goTrack = useCallback(
    (delta: number) => {
      const len = assets.length;
      if (len === 0) return;
      pendingPlayRef.current = true;
      if (shuffle && len > 1) {
        setCurrentIndex((i) => {
          let j = Math.floor(Math.random() * len);
          while (j === i) j = Math.floor(Math.random() * len);
          return j;
        });
        return;
      }
      setCurrentIndex((i) => (i + delta + len) % len);
    },
    [assets.length, shuffle],
  );

  const playTrackAt = useCallback((index: number) => {
    pendingPlayRef.current = true;
    setPlayerVisible(true);
    setCurrentIndex(index);
    setPlayGeneration((g) => g + 1);
  }, []);

  const togglePlay = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) void el.play();
    else el.pause();
  }, []);

  const handleEnded = useCallback(() => {
    if (assets.length <= 1) return;
    pendingPlayRef.current = true;
    setCurrentIndex((i) => {
      const len = assets.length;
      if (shuffle && len > 1) {
        let j = Math.floor(Math.random() * len);
        while (j === i) j = Math.floor(Math.random() * len);
        return j;
      }
      return (i + 1) % len;
    });
  }, [assets.length, shuffle]);

  const cycleRepeat = useCallback(() => {
    setRepeatMode((m) => (m === "off" ? "all" : m === "all" ? "one" : "off"));
  }, []);

  const handleRowPlayClick = useCallback(
    (index: number) => {
      const isActive = playerVisible && index === currentIndex;
      if (isActive) {
        togglePlay();
        return;
      }
      playTrackAt(index);
    },
    [playerVisible, currentIndex, togglePlay, playTrackAt],
  );

  const executeDelete = useCallback(async () => {
    if (!confirmDeleteId) return;
    const id = confirmDeleteId;
    const activePlayingId =
      playerVisible && currentTrack ? currentTrack.id : null;
    const deleteCurrent = activePlayingId === id;

    setDeleteError(null);
    setDeleteSubmitting(true);
    try {
      await apiDeleteAsset(id);
      setConfirmDeleteId(null);
      const list = await reloadAssets({ silent: true });

      if (deleteCurrent) {
        setPlayerVisible(false);
        setPlaying(false);
        setCurrentIndex(0);
      } else if (activePlayingId) {
        const ix = list.findIndex((a) => a.id === activePlayingId);
        if (ix >= 0) setCurrentIndex(ix);
      } else {
        setCurrentIndex((i) =>
          list.length === 0 ? 0 : Math.min(i, list.length - 1),
        );
      }
    } catch (err) {
      setDeleteError(
        err instanceof ApiRequestError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Не удалось удалить",
      );
    } finally {
      setDeleteSubmitting(false);
    }
  }, [confirmDeleteId, currentTrack, playerVisible, reloadAssets]);

  const playerSubtitle =
    currentTrack?.description?.trim() ||
    (assets.length > 0
      ? `Track ${currentIndex + 1} of ${assets.length} · Family Media`
      : "");

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <main className="min-h-0 flex-1 overflow-y-auto px-4 py-8 pb-40 md:px-6">
        <div className="mx-auto max-w-5xl">
          <h1 className="mb-4 text-2xl font-semibold tracking-tight">Music</h1>

          <MusicUploadForm onUploaded={() => void reloadAssets({ silent: true })} />

          {loading ? (
            <p className="text-muted-foreground">Loading music…</p>
          ) : error ? (
            <Card className="border-destructive/40">
              <CardHeader>
                <CardTitle>Could not load library</CardTitle>
                <CardDescription>{error}</CardDescription>
              </CardHeader>
            </Card>
          ) : assets.length === 0 ? (
            <p className="text-muted-foreground">
              No audio yet. Add MP3, M4A, WAV, FLAC, or OGG above (multiple files at once).
            </p>
          ) : (
            <ul className="space-y-3">
              {assets.map((asset, index) => {
                const duration = formatDuration(asset.primary_version?.duration_ms);
                const isActive = playerVisible && index === currentIndex;
                return (
                  <li key={asset.id}>
                    <Card>
                      <CardHeader className="flex flex-row items-start gap-4 space-y-0 pb-3">
                        <div className="min-w-0 flex-1">
                          <CardTitle className="text-base leading-snug">
                            {asset.title ?? "Untitled track"}
                          </CardTitle>
                          <CardDescription className="mt-1 line-clamp-2">
                            {asset.description ??
                              (duration ? `Duration ${duration}` : "Audio")}
                          </CardDescription>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <Button
                            type="button"
                            size="icon"
                            variant={isActive ? "default" : "secondary"}
                            className="h-9 w-9 rounded-full"
                            aria-label={
                              isActive && playing ? "Пауза" : "Воспроизвести"
                            }
                            onClick={() => handleRowPlayClick(index)}
                          >
                            {isActive && playing ? (
                              <Pause className="h-4 w-4" />
                            ) : (
                              <Play className="h-4 w-4 fill-current" />
                            )}
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-9 w-9 text-destructive hover:bg-destructive/10 hover:text-destructive"
                            aria-label="Удалить трек"
                            onClick={() => {
                              setDeleteError(null);
                              setConfirmDeleteId(asset.id);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardHeader>
                    </Card>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </main>

      {playerVisible && assets.length > 0 && currentTrack ? (
        <footer className="sticky bottom-0 z-10 shrink-0 border-t border-white/10 bg-zinc-950/95 px-3 py-3 backdrop-blur-md md:px-6 md:py-4">
          <div className="mx-auto max-w-5xl">
            <audio
              ref={audioRef}
              key={currentTrack.id}
              className="hidden"
              src={assetFileUrl(currentTrack.id)}
              preload="metadata"
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onEnded={handleEnded}
            />
            <MusicPlayerBar
              audioRef={audioRef}
              trackId={currentTrack.id}
              title={currentTrack.title ?? "Untitled track"}
              subtitle={playerSubtitle}
              playing={playing}
              onTogglePlay={togglePlay}
              onPrevious={() => goTrack(-1)}
              onNext={() => goTrack(1)}
              singleTrack={assets.length <= 1}
              shuffle={shuffle}
              onShuffleToggle={() => setShuffle((s) => !s)}
              repeatMode={repeatMode}
              onRepeatCycle={cycleRepeat}
            />
          </div>
        </footer>
      ) : null}

      {confirmDeleteId ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-track-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !deleteSubmitting) {
              setConfirmDeleteId(null);
              setDeleteError(null);
            }
          }}
        >
          <div className="w-full max-w-md rounded-xl border border-border bg-background p-6 shadow-xl">
            <h2 id="delete-track-title" className="text-base font-semibold">
              Удаление трека
            </h2>
            <p className="mt-3 text-sm text-muted-foreground">
              Вы действительно хотите удалить этот трек? Это действие нельзя отменить.
            </p>
            {deleteError ? (
              <p className="mt-2 text-sm text-destructive">{deleteError}</p>
            ) : null}
            <div className="mt-6 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={deleteSubmitting}
                onClick={() => {
                  setConfirmDeleteId(null);
                  setDeleteError(null);
                }}
              >
                Отмена
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={deleteSubmitting}
                onClick={() => void executeDelete()}
              >
                {deleteSubmitting ? "Удаление…" : "Удалить"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
