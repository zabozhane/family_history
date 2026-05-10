"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { ChevronLeft, ChevronRight, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { assetFileUrl } from "@/lib/media-url";
import type { AssetRead } from "@/lib/types";

export type GalleryLightboxProps = {
  assets: AssetRead[];
  index: number | null;
  onClose: () => void;
  onIndexChange: (i: number) => void;
  /** Opens parent confirmation — typical pattern when reviewing one photo */
  onRequestDelete?: () => void;
};

export function GalleryLightbox({
  assets,
  index,
  onClose,
  onIndexChange,
  onRequestDelete,
}: GalleryLightboxProps) {
  const open =
    index !== null && index >= 0 && index < assets.length && assets.length > 0;
  const asset = open ? assets[index] : null;

  const touchStartX = useRef<number | null>(null);
  const [videoLoadError, setVideoLoadError] = useState(false);

  const activeAssetId =
    open && index !== null && index >= 0 && index < assets.length
      ? assets[index]?.id
      : null;

  useEffect(() => {
    setVideoLoadError(false);
  }, [activeAssetId]);

  const goPrev = useCallback(() => {
    if (index === null || assets.length === 0) return;
    onIndexChange((index - 1 + assets.length) % assets.length);
  }, [assets.length, index, onIndexChange]);

  const goNext = useCallback(() => {
    if (index === null || assets.length === 0) return;
    onIndexChange((index + 1) % assets.length);
  }, [assets.length, index, onIndexChange]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, goPrev, goNext]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open || !asset) return null;

  const title = asset.title?.trim() || "Untitled";
  const videoMime = asset.primary_version?.mime_type;

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-black/55 backdrop-blur-2xl backdrop-saturate-150 supports-[backdrop-filter]:bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-label={`Media viewer, ${index !== null ? index + 1 : 0} of ${assets.length}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/10 bg-black/30 px-3 py-2 text-white/95 backdrop-blur-md">
        <p className="min-w-0 truncate text-sm font-medium">{title}</p>
        <div className="flex shrink-0 items-center gap-0.5">
          <span className="hidden text-xs tabular-nums text-white/55 sm:inline">
            {index !== null ? index + 1 : 0} / {assets.length}
          </span>
          {onRequestDelete ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-white/85 hover:bg-red-500/25 hover:text-red-200"
              aria-label="Удалить фото"
              onClick={(e) => {
                e.stopPropagation();
                onRequestDelete();
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-white hover:bg-white/15 hover:text-white"
            aria-label="Close"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div
        className="relative flex min-h-0 flex-1 items-center justify-center px-2 pb-4 pt-0 sm:px-10"
        onTouchStart={(e) => {
          touchStartX.current = e.changedTouches[0]?.clientX ?? null;
        }}
        onTouchEnd={(e) => {
          const start = touchStartX.current;
          touchStartX.current = null;
          if (start === null) return;
          const end = e.changedTouches[0]?.clientX;
          if (end === undefined) return;
          const dx = end - start;
          if (dx > 56) goPrev();
          else if (dx < -56) goNext();
        }}
      >
        {assets.length > 1 ? (
          <>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute left-0.5 top-1/2 z-10 h-10 w-10 -translate-y-1/2 rounded-full text-white hover:bg-white/15 hover:text-white sm:left-3 sm:h-11 sm:w-11"
              aria-label="Previous photo"
              onClick={(e) => {
                e.stopPropagation();
                goPrev();
              }}
            >
              <ChevronLeft className="h-8 w-8" strokeWidth={1.5} />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-0.5 top-1/2 z-10 h-10 w-10 -translate-y-1/2 rounded-full text-white hover:bg-white/15 hover:text-white sm:right-3 sm:h-11 sm:w-11"
              aria-label="Next photo"
              onClick={(e) => {
                e.stopPropagation();
                goNext();
              }}
            >
              <ChevronRight className="h-8 w-8" strokeWidth={1.5} />
            </Button>
          </>
        ) : null}

        {asset.asset_type === "video" ? (
          <div className="flex max-h-full max-w-full flex-col items-center gap-3">
            <video
              key={asset.id}
              controls
              playsInline
              preload="metadata"
              className="max-h-[min(85vh,calc(100dvh-6rem))] max-w-full touch-pan-y rounded-lg object-contain shadow-[0_25px_80px_-12px_rgba(0,0,0,0.85)] ring-1 ring-white/20"
              onClick={(e) => e.stopPropagation()}
              onError={() => setVideoLoadError(true)}
            >
              <source src={assetFileUrl(asset.id)} type={videoMime || undefined} />
            </video>
            {videoLoadError ? (
              <p className="max-w-md px-4 text-center text-sm leading-snug text-white/90">
                Браузер не смог воспроизвести это видео. Записи экрана с Mac часто в
                формате{" "}
                <span className="whitespace-nowrap">.mov / HEVC</span> — в Chrome они
                могут не поддерживаться. Откройте в Safari или экспортируйте ролик в{" "}
                <span className="whitespace-nowrap">MP4 (H.264)</span> и загрузите снова.
              </p>
            ) : null}
          </div>
        ) : (
          <img
            src={assetFileUrl(asset.id)}
            alt={title}
            className="max-h-[min(85vh,calc(100dvh-6rem))] max-w-full touch-pan-y rounded-lg object-contain shadow-[0_25px_80px_-12px_rgba(0,0,0,0.85)] ring-1 ring-white/20 select-none"
            draggable={false}
            onClick={(e) => e.stopPropagation()}
          />
        )}
      </div>

    </div>
  );
}
