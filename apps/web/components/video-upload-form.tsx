"use client";

import { useRef, useState } from "react";

import { Film } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ApiRequestError, apiUploadAsset } from "@/lib/api";

export type VideoUploadFormProps = {
  onUploaded: () => void;
};

const DEFAULT_SCOPE = "private" as const;

export function VideoUploadForm({ onUploaded }: VideoUploadFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickedLabel, setPickedLabel] = useState<string | null>(null);

  async function runUpload() {
    const input = fileInputRef.current;
    const file = input?.files?.item(0);
    if (!file || file.size === 0) {
      setError("Choose a video file.");
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("permission_scope", DEFAULT_SCOPE);
      await apiUploadAsset(fd);
      if (input) input.value = "";
      setPickedLabel(null);
      onUploaded();
    } catch (err) {
      setError(
        err instanceof ApiRequestError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Upload failed",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
      <input
        ref={fileInputRef}
        type="file"
        name="file"
        accept="video/mp4,video/quicktime,video/webm,video/*"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        disabled={submitting}
        onChange={() => {
          const f = fileInputRef.current?.files?.item(0);
          setPickedLabel(f ? f.name : null);
        }}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          disabled={submitting}
          onClick={() => fileInputRef.current?.click()}
        >
          <Film className="h-4 w-4" aria-hidden />
          Add video
        </Button>
        {pickedLabel ? (
          <span className="max-w-[12rem] truncate text-xs text-muted-foreground" title={pickedLabel}>
            {pickedLabel}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">MP4, MOV, WebM</span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
        <Button type="button" size="sm" disabled={submitting} onClick={() => void runUpload()}>
          {submitting ? "Uploading…" : "Upload"}
        </Button>
      </div>

      {error ? (
        <p className="basis-full text-sm text-destructive">{error}</p>
      ) : null}
    </div>
  );
}
