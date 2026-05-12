"use client";

import { useCallback, useEffect, useState } from "react";

import { Trash2 } from "lucide-react";

import { AssetVideoThumb } from "@/components/asset-video-thumb";
import { GalleryLightbox } from "@/components/gallery-lightbox";
import { VideoUploadForm } from "@/components/video-upload-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ApiRequestError, apiDeleteAsset, apiFetch, buildAssetsListPath } from "@/lib/api";
import { useWorkspace } from "@/components/workspace-context";
import type { AssetRead } from "@/lib/types";
import { uploadedByDisplayName } from "@/lib/utils";

export default function VideoPage() {
  const { ready, activeWorkspaceId } = useWorkspace();

  const [assets, setAssets] = useState<AssetRead[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const reloadAssets = useCallback(async (opts?: { silent?: boolean }) => {
    if (!activeWorkspaceId) {
      setAssets([]);
      if (!opts?.silent) setLoading(false);
      setLoadError(null);
      return;
    }
    if (!opts?.silent) setLoading(true);
    setLoadError(null);
    try {
      const rows = await apiFetch<AssetRead[]>(
        buildAssetsListPath(200, activeWorkspaceId),
      );
      setAssets(rows.filter((a) => a.asset_type === "video"));
    } catch (err) {
      if (!opts?.silent) {
        setLoadError(
          err instanceof ApiRequestError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Failed to load videos",
        );
      }
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, [activeWorkspaceId]);

  useEffect(() => {
    if (!ready) return;
    void reloadAssets();
  }, [ready, reloadAssets]);

  useEffect(() => {
    if (lightboxIndex === null) return;
    if (assets.length === 0) {
      setLightboxIndex(null);
      return;
    }
    if (lightboxIndex >= assets.length) {
      setLightboxIndex(assets.length - 1);
    }
  }, [assets, lightboxIndex]);

  const executeDelete = useCallback(async () => {
    if (!confirmDeleteId) return;
    setDeleteError(null);
    setDeleteSubmitting(true);
    try {
      const delIdx = assets.findIndex((a) => a.id === confirmDeleteId);
      const oldLen = assets.length;
      const openIdx = lightboxIndex;

      await apiDeleteAsset(confirmDeleteId);
      setConfirmDeleteId(null);
      await reloadAssets({ silent: true });

      if (oldLen <= 1) {
        setLightboxIndex(null);
      } else if (openIdx !== null && delIdx >= 0) {
        let next = openIdx;
        if (delIdx < openIdx) next = openIdx - 1;
        else if (delIdx === openIdx) next = Math.min(openIdx, oldLen - 2);
        else next = openIdx;
        setLightboxIndex(Math.max(0, Math.min(next, oldLen - 2)));
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
  }, [confirmDeleteId, assets, lightboxIndex, reloadAssets]);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-4 text-2xl font-semibold tracking-tight">Videos</h1>

      <VideoUploadForm onUploaded={() => void reloadAssets({ silent: true })} />

      <GalleryLightbox
        assets={assets}
        index={lightboxIndex}
        onClose={() => setLightboxIndex(null)}
        onIndexChange={setLightboxIndex}
        onRequestDelete={() => {
          if (lightboxIndex === null) return;
          setDeleteError(null);
          setConfirmDeleteId(assets[lightboxIndex]?.id ?? null);
        }}
      />

      {loading ? (
        <p className="text-muted-foreground">Loading videos…</p>
      ) : loadError ? (
        <Card className="mb-8 border-destructive/40">
          <CardHeader>
            <CardTitle>Could not load videos</CardTitle>
            <CardDescription>{loadError}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              You can still try uploading above; refresh or sign in again if the
              error persists.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {!loading && !loadError && assets.length === 0 ? (
        <p className="text-muted-foreground">
          No videos yet. Use <strong className="font-medium">Add video</strong>{" "}
          above (MP4, MOV, or WebM).
        </p>
      ) : null}

      {!loading && !loadError && assets.length > 0 ? (
        <ul className="grid grid-cols-4 gap-1.5 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-9 xl:grid-cols-10">
          {assets.map((asset, i) => (
            <li key={asset.id} className="group">
              <div className="relative overflow-hidden rounded-md border border-border bg-card shadow-sm transition hover:border-primary/40">
                <button
                  type="button"
                  className="block w-full text-left outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => setLightboxIndex(i)}
                >
                  <div className="relative aspect-square bg-muted">
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
                <button
                  type="button"
                  className="absolute right-0.5 top-0.5 z-20 flex h-7 w-7 items-center justify-center rounded-md bg-black/50 text-destructive shadow-sm backdrop-blur-sm transition hover:bg-destructive hover:text-destructive-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
                  aria-label="Удалить видео"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteError(null);
                    setConfirmDeleteId(asset.id);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {confirmDeleteId ? (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-video-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !deleteSubmitting) {
              setConfirmDeleteId(null);
              setDeleteError(null);
            }
          }}
        >
          <div className="w-full max-w-md rounded-xl border border-border bg-background p-6 shadow-xl">
            <h2 id="delete-video-title" className="text-base font-semibold">
              Удаление видео
            </h2>
            <p className="mt-3 text-sm text-muted-foreground">
              Удалить это видео? Его нельзя будет восстановить.
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
    </main>
  );
}
