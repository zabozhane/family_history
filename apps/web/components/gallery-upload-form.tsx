"use client";

import { useRef, useState } from "react";

import { ImagePlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ApiRequestError, apiUploadAsset } from "@/lib/api";
import { useWorkspace } from "@/components/workspace-context";

export type GalleryUploadFormProps = {
  onUploaded: () => void;
};

/** Visibility fixed until we expose UI again — uploads stay private-only in the form. */
const DEFAULT_SCOPE = "private" as const;

export function GalleryUploadForm({ onUploaded }: GalleryUploadFormProps) {
  const { activeWorkspaceId, ready } = useWorkspace();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickedLabel, setPickedLabel] = useState<string | null>(null);

  async function runUpload() {
    const input = fileInputRef.current;
    const file = input?.files?.item(0);
    if (!file || file.size === 0) {
      setError("Choose an image file.");
      return;
    }

    setError(null);
    if (!ready || !activeWorkspaceId) {
      setError("Choose a workspace in the sidebar first.");
      return;
    }
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("permission_scope", DEFAULT_SCOPE);
      fd.append("workspace_id", activeWorkspaceId);
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
        accept="image/jpeg,image/png,image/gif,image/webp,image/heic"
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
          disabled={submitting || !ready || !activeWorkspaceId}
          onClick={() => fileInputRef.current?.click()}
        >
          <ImagePlus className="h-4 w-4" aria-hidden />
          Add photo
        </Button>
        {pickedLabel ? (
          <span className="max-w-[12rem] truncate text-xs text-muted-foreground" title={pickedLabel}>
            {pickedLabel}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">
            JPEG, PNG, GIF, WebP, HEIC
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
        <Button
          type="button"
          size="sm"
          disabled={submitting || !ready || !activeWorkspaceId}
          onClick={() => void runUpload()}
        >
          {submitting ? "Uploading…" : "Upload"}
        </Button>
      </div>

      {error ? (
        <p className="basis-full text-sm text-destructive">{error}</p>
      ) : null}
    </div>
  );
}
