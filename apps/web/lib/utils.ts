import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

import type { AssetRead } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Safe label for who uploaded the asset (handles older API payloads without `uploaded_by`). */
export function uploadedByDisplayName(asset: AssetRead): string {
  const name = asset.uploaded_by?.display_name?.trim();
  return name || "Unknown";
}

/** Lowercase UUID or null if the string is not a valid UUID. */
export function parseUuid(raw: string): string | null {
  const t = raw.trim();
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      t,
    )
  ) {
    return null;
  }
  return t.toLowerCase();
}
