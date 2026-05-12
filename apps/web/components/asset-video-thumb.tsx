"use client";

import { assetFileUrl } from "@/lib/media-url";

export function AssetVideoThumb({ assetId, alt }: { assetId: string; alt: string }) {
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
