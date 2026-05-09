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

export default function GalleryPage() {
  const [assets, setAssets] = useState<AssetRead[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    apiFetch<AssetRead[]>("/api/v1/assets?limit=200")
      .then((rows) => {
        if (!cancelled) setAssets(rows.filter((a) => a.asset_type === "image"));
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof ApiRequestError
              ? err.message
              : err instanceof Error
                ? err.message
                : "Failed to load photos",
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
      <main className="mx-auto max-w-5xl px-4 py-8">
        <p className="text-muted-foreground">Loading photos…</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-8">
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle>Could not load gallery</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  if (assets.length === 0) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="mb-2 text-2xl font-semibold tracking-tight">Photos</h1>
        <p className="text-muted-foreground">
          No images yet. Upload JPEG, PNG, WebP, or GIF via the API{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">
            POST /api/v1/assets
          </code>{" "}
          to see them here.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Photos</h1>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {assets.map((asset) => (
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
    </main>
  );
}
