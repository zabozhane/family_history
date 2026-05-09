"use client";

import { useEffect, useState } from "react";

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

function formatDuration(ms: number | null | undefined): string | null {
  if (ms == null || ms <= 0) return null;
  const totalSec = Math.round(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function MusicPage() {
  const [assets, setAssets] = useState<AssetRead[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    apiFetch<AssetRead[]>("/api/v1/assets?limit=200")
      .then((rows) => {
        if (!cancelled) setAssets(rows.filter((a) => a.asset_type === "audio"));
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof ApiRequestError
              ? err.message
              : err instanceof Error
                ? err.message
                : "Failed to load tracks",
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

  if (loading) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-8">
        <p className="text-muted-foreground">Loading music…</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-8">
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle>Could not load library</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  if (assets.length === 0) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="mb-2 text-2xl font-semibold tracking-tight">Music</h1>
        <p className="text-muted-foreground">
          No audio yet. Upload MP3, WAV, FLAC, OGG, or M4A via{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">
            POST /api/v1/assets
          </code>{" "}
          to play tracks here.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl space-y-4 px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Music</h1>
      <ul className="space-y-4">
        {assets.map((asset) => {
          const duration = formatDuration(asset.primary_version?.duration_ms);
          return (
            <li key={asset.id}>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">
                    {asset.title ?? "Untitled track"}
                  </CardTitle>
                  <CardDescription className="line-clamp-2">
                    {asset.description ??
                      (duration ? `Duration ${duration}` : "Audio")}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {asset.primary_version ? (
                    <audio
                      controls
                      className="w-full"
                      src={assetFileUrl(asset.id)}
                      preload="metadata"
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">No audio file</p>
                  )}
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
