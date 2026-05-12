// Mirrors apps/api/app/schemas/{auth,user}.py.

export type UserRole = "admin" | "family" | "child" | "guest";

export interface UserRead {
  id: string;
  email: string;
  display_name: string;
  role: UserRole;
  is_active: boolean;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: "bearer";
  expires_in: number;
}

export interface ApiError {
  detail: string | { msg: string }[];
}

export type AssetType =
  | "image"
  | "video"
  | "audio"
  | "note"
  | "document"
  | "voice_note"
  | "link"
  | "archive";

export type PermissionScope = "private" | "family" | "shared" | "public_link";

export interface AssetVersionRead {
  id: string;
  asset_id: string;
  storage_key: string;
  mime_type: string;
  size_bytes: number;
  width: number | null;
  height: number | null;
  duration_ms: number | null;
  is_primary: boolean;
  media_metadata: Record<string, unknown>;
}

export interface AssetRead {
  id: string;
  workspace_id: string;
  owner_id: string;
  asset_type: AssetType;
  title: string | null;
  description: string | null;
  captured_at: string | null;
  /** When the asset row was created (upload time); used for timeline when `captured_at` is absent. */
  created_at: string;
  permission_scope: PermissionScope;
  primary_version: AssetVersionRead | null;
}

/** Mirrors `AssetUploadResponse` from apps/api `schemas/asset.py`. */
export interface AssetUploadResponse {
  asset: AssetRead;
  version: AssetVersionRead;
}

export type TimelineEntryKind = "asset_added" | "event" | "activity";

export interface TimelineAssetVersionRead {
  id: string;
  storage_key: string;
  mime_type: string;
  size_bytes: number;
  width: number | null;
  height: number | null;
  duration_ms: number | null;
}

export interface TimelineAssetRead {
  id: string;
  owner_id: string;
  asset_type: AssetType;
  title: string | null;
  description: string | null;
  captured_at: string | null;
  permission_scope: PermissionScope;
}

export interface TimelineItemRead {
  id: string;
  user_id: string;
  asset_id: string | null;
  kind: TimelineEntryKind;
  occurred_at: string;
  payload: Record<string, unknown>;
  asset: TimelineAssetRead | null;
  primary_version: TimelineAssetVersionRead | null;
}

