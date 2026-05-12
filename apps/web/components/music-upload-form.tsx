"use client";

import { useRef, useState } from "react";

import { Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ApiRequestError, apiUploadAsset } from "@/lib/api";
import { useWorkspace } from "@/components/workspace-context";
import type { PermissionScope } from "@/lib/types";
import { cn } from "@/lib/utils";

const PERMISSION_OPTIONS: { value: PermissionScope; label: string }[] = [
  { value: "private", label: "Private" },
  { value: "family", label: "Family" },
  { value: "shared", label: "Shared" },
  { value: "public_link", label: "Public link" },
];

const SELECT_CLASS =
  "h-9 rounded-md border border-input bg-background px-2.5 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50";

/** Browser hint — server validates MIME (`audio/*` only). */
const AUDIO_ACCEPT =
  "audio/mpeg,audio/mp4,audio/wav,audio/flac,audio/ogg,.mp3,.m4a,.wav,.flac,.ogg";

export type MusicUploadFormProps = {
  onUploaded: () => void;
};

export function MusicUploadForm({ onUploaded }: MusicUploadFormProps) {
  const { activeWorkspaceId, ready } = useWorkspace();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scope, setScope] = useState<PermissionScope>("private");
  const [pickedLabel, setPickedLabel] = useState<string | null>(null);

  async function runUpload() {
    const input = fileInputRef.current;
    const files = input?.files;
    if (!files?.length) {
      setError("Choose one or more audio files.");
      return;
    }

    setError(null);
    if (!ready || !activeWorkspaceId) {
      setError("Choose a workspace in the sidebar first.");
      return;
    }
    setSubmitting(true);
    try {
      const total = files.length;
      for (let i = 0; i < total; i++) {
        const file = files.item(i);
        if (!file || file.size === 0) continue;
        const fd = new FormData();
        fd.append("file", file);
        fd.append("permission_scope", scope);
        fd.append("workspace_id", activeWorkspaceId);
        await apiUploadAsset(fd);
      }
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
    <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
      <input
        ref={fileInputRef}
        type="file"
        accept={AUDIO_ACCEPT}
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={() => {
          const n = fileInputRef.current?.files?.length ?? 0;
          setPickedLabel(n > 0 ? `${n} file${n === 1 ? "" : "s"} selected` : null);
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
          <Upload className="h-4 w-4" aria-hidden />
          Add tracks
        </Button>
        {pickedLabel ? (
          <span className="text-xs text-muted-foreground">{pickedLabel}</span>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
        <Label htmlFor="music-scope-inline" className="sr-only">
          Visibility
        </Label>
        <select
          id="music-scope-inline"
          value={scope}
          onChange={(e) => setScope(e.target.value as PermissionScope)}
          disabled={submitting || !ready || !activeWorkspaceId}
          className={cn(SELECT_CLASS, "min-w-[8.5rem]")}
        >
          {PERMISSION_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
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
