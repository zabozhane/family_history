"use client";

import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiRequestError, apiUploadAsset } from "@/lib/api";
import type { PermissionScope } from "@/lib/types";
import { cn } from "@/lib/utils";

const PERMISSION_OPTIONS: { value: PermissionScope; label: string }[] = [
  { value: "private", label: "Private" },
  { value: "family", label: "Family" },
  { value: "shared", label: "Shared" },
  { value: "public_link", label: "Public link" },
];

const SELECT_CLASS =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

export type GalleryUploadFormProps = {
  onUploaded: () => void;
};

export function GalleryUploadForm({ onUploaded }: GalleryUploadFormProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const raw = new FormData(form);
    const fileEntry = raw.get("file");

    if (!(fileEntry instanceof File) || fileEntry.size === 0) {
      setError("Choose an image file.");
      return;
    }

    const fd = new FormData();
    fd.append("file", fileEntry);

    const scope = raw.get("permission_scope");
    if (typeof scope === "string" && scope.length > 0) {
      fd.append("permission_scope", scope);
    }

    setSubmitting(true);
    try {
      await apiUploadAsset(fd);
      form.reset();
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
    <Card className="mb-8">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg">Upload a photo</CardTitle>
        <CardDescription>
          JPEG, PNG, GIF, WebP, or HEIC. Pick who can see it below.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-4" onSubmit={(ev) => void handleSubmit(ev)}>
          {error ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="gallery-file">Image file</Label>
            <Input
              id="gallery-file"
              name="file"
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp,image/heic"
              required
              disabled={submitting}
              className={cn("cursor-pointer")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="gallery-scope">Who can see it</Label>
            <select
              id="gallery-scope"
              name="permission_scope"
              defaultValue="private"
              disabled={submitting}
              className={SELECT_CLASS}
            >
              {PERMISSION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <Button type="submit" disabled={submitting}>
            {submitting ? "Uploading…" : "Upload"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
