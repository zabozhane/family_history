"use client";

import { useState } from "react";

import { assetFileUrl } from "@/lib/media-url";
import { cn } from "@/lib/utils";

/** Loads **`/api/fms/v1/assets/{id}/file`** without requiring **`primary_version`** in list payloads. */
export function AssetImageThumb({
  assetId,
  alt,
  imgClassName,
}: {
  assetId: string;
  alt: string;
  imgClassName?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className="flex h-full items-center justify-center p-2 text-center text-xs text-muted-foreground">
        No preview
      </div>
    );
  }

  return (
    <img
      src={assetFileUrl(assetId)}
      alt={alt}
      loading="lazy"
      className={cn("h-full w-full object-cover", imgClassName)}
      onError={() => setFailed(true)}
    />
  );
}
