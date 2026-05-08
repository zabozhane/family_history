// Mirrors apps/api/app/schemas/{auth,user}.py.
// TODO(T12): generate from OpenAPI instead of hand-mirroring.

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
