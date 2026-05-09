"use client";

import { useCallback, useEffect, useState } from "react";

import { AssetImageThumb } from "@/components/asset-image-thumb";
import { GalleryUploadForm } from "@/components/gallery-upload-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ApiRequestError, apiFetch } from "@/lib/api";
import type { AssetRead } from "@/lib/types";

export default function GalleryPage() {
  const [assets, setAssets] = useState<AssetRead[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reloadAssets = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    setLoadError(null);
    try {
      const rows = await apiFetch<AssetRead[]>("/api/v1/assets?limit=200");
      setAssets(rows.filter((a) => a.asset_type === "image"));
    } catch (err) {
      if (!opts?.silent) {
        setLoadError(
          err instanceof ApiRequestError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Failed to load photos",
        );
      }
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reloadAssets();
  }, [reloadAssets]);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Photos</h1>

      <GalleryUploadForm onUploaded={() => void reloadAssets({ silent: true })} />

      {loading ? (
        <p className="text-muted-foreground">Loading photos…</p>
      ) : loadError ? (
        <Card className="mb-8 border-destructive/40">
          <CardHeader>
            <CardTitle>Could not load gallery</CardTitle>
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
          No images yet. Upload one using the form above (JPEG, PNG, WebP, GIF,
          or HEIC).
        </p>
      ) : null}

      {!loading && !loadError && assets.length > 0 ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {assets.map((asset) => (
            <li key={asset.id}>
              <Card className="overflow-hidden py-0">
                <div className="aspect-square bg-muted">
                  <AssetImageThumb
                    assetId={asset.id}
                    alt={asset.title ?? "Photo"}
                  />
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
      ) : null}
    </main>
  );
}
