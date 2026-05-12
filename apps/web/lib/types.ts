// Mirrors apps/api/app/schemas/{auth,user}.py.

export type UserRole = "admin" | "family" | "child" | "guest";

/** Mirrors `WorkspaceKind` / `WorkspaceMembershipRole` (apps/api `schemas/workspace.py`). */
export type WorkspaceKind = "personal" | "shared";

export type WorkspaceMembershipRole = "owner" | "editor" | "viewer";

export interface WorkspaceRead {
  id: string;
  name: string;
  kind: WorkspaceKind;
  created_by_id: string;
  created_at: string;
  updated_at: string;
  membership_role: WorkspaceMembershipRole;
}

/** Mirrors `WorkspaceMemberRead` (apps/api `schemas/invitation.py`). */
export interface WorkspaceMemberRead {
  user_id: string;
  email: string;
  display_name: string;
  role: WorkspaceMembershipRole;
}

export interface WorkspaceCreate {
  name: string;
  kind: WorkspaceKind;
}

/** Mirrors `JoinRequestStatus` / notification payloads (workspace join flow). */
export type JoinRequestStatus = "pending" | "approved" | "rejected";

export interface UserJoinSummary {
  id: string;
  email: string;
  display_name: string;
}

/** Mirrors `JoinRequestRead` (apps/api `schemas/join_request.py`). */
export interface JoinRequestRead {
  id: string;
  workspace_id: string;
  workspace_name: string;
  status: JoinRequestStatus;
  created_at: string;
  requester: UserJoinSummary | null;
}

export interface JoinRequestNotificationPayload {
  id: string;
  workspace_id: string;
  workspace_name: string;
  status: JoinRequestStatus;
  requester: UserJoinSummary;
}

export interface NotificationRead {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  read_at: string | null;
  created_at: string;
  join_request: JoinRequestNotificationPayload | null;
}

export const NOTIFICATION_KIND_JOIN_REQUEST_PENDING = "join_request_pending";
export const NOTIFICATION_KIND_JOIN_REQUEST_APPROVED = "join_request_approved";
export const NOTIFICATION_KIND_JOIN_REQUEST_REJECTED = "join_request_rejected";

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

