"use client";

import { useCallback, useEffect, useState } from "react";

import { Pause, Play, Trash2 } from "lucide-react";

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  sortAudioTracks,
  useMusicPlayer,
} from "@/components/music-player-context";
import { MusicUploadForm } from "@/components/music-upload-form";
import { ApiRequestError, apiDeleteAsset, apiFetch } from "@/lib/api";
import type { AssetRead } from "@/lib/types";

function formatDuration(ms: number | null | undefined): string | null {
  if (ms == null || ms <= 0) return null;
  const totalSec = Math.round(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function MusicPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const {
    queue: assets,
    replaceQueue,
    playerVisible,
    playing,
    currentIndex,
    handleRowPlayClick,
  } = useMusicPlayer();

  const reloadAssets = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setLoading(true);
      setError(null);
      try {
        const rows = await apiFetch<AssetRead[]>("/api/v1/assets?limit=200");
        const sorted = sortAudioTracks(rows);
        replaceQueue(sorted);
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
    },
    [replaceQueue],
  );

  useEffect(() => {
    void reloadAssets();
  }, [reloadAssets]);

  const executeDelete = useCallback(async () => {
    if (!confirmDeleteId) return;
    setDeleteError(null);
    setDeleteSubmitting(true);
    try {
      await apiDeleteAsset(confirmDeleteId);
      setConfirmDeleteId(null);
      await reloadAssets({ silent: true });
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
  }, [confirmDeleteId, reloadAssets]);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <main className="min-h-0 flex-1 px-4 py-8 md:px-6">
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
            <ul className="space-y-1.5">
              {assets.map((asset, index) => {
                const duration = formatDuration(asset.primary_version?.duration_ms);
                const isActive = playerVisible && index === currentIndex;
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
                            variant={isActive ? "default" : "secondary"}
                            className="h-8 w-8 rounded-full"
                            aria-label={
                              isActive && playing ? "Пауза" : "Воспроизвести"
                            }
                            onClick={() => handleRowPlayClick(index)}
                          >
                            {isActive && playing ? (
                              <Pause className="h-3.5 w-3.5" />
                            ) : (
                              <Play className="h-3.5 w-3.5 fill-current" />
                            )}
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                            aria-label="Удалить трек"
                            onClick={() => {
                              setDeleteError(null);
                              setConfirmDeleteId(asset.id);
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
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
