"use client";

// TODO(T12): rebuild as a proper protected layout with shadcn/ui.
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { ApiRequestError, apiFetch } from "../../lib/api";
import { clearTokens, getAccessToken } from "../../lib/auth";
import {
  card,
  errorBox,
  ghostButton,
  heading,
  pageWrap,
} from "../../lib/styles";
import type { UserRead } from "../../lib/types";

export default function MePage() {
  const router = useRouter();
  const [user, setUser] = useState<UserRead | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace("/login");
      return;
    }
    let active = true;
    apiFetch<UserRead>("/api/v1/users/me")
      .then((data) => {
        if (active) setUser(data);
      })
      .catch((err) => {
        if (!active) return;
        if (err instanceof ApiRequestError && err.status === 401) {
          clearTokens();
          router.replace("/login");
          return;
        }
        setError(err instanceof Error ? err.message : "Failed to load profile");
      });
    return () => {
      active = false;
    };
  }, [router]);

  function handleLogout() {
    clearTokens();
    router.replace("/login");
  }

  if (error) {
    return (
      <main style={pageWrap}>
        <div style={card}>
          <h1 style={heading}>Profile</h1>
          <div style={errorBox}>{error}</div>
          <button onClick={handleLogout} style={ghostButton}>
            Logout
          </button>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main style={pageWrap}>
        <div style={card}>
          <p style={{ opacity: 0.6 }}>Loading…</p>
        </div>
      </main>
    );
  }

  return (
    <main style={pageWrap}>
      <div style={card}>
        <h1 style={heading}>{user.display_name}</h1>
        <p style={{ margin: "0 0 1.25rem", opacity: 0.7, fontSize: "0.9rem" }}>
          {user.email}
        </p>
        <dl
          style={{
            margin: "0 0 1.5rem",
            fontSize: "0.9rem",
            display: "grid",
            gridTemplateColumns: "auto 1fr",
            rowGap: 6,
            columnGap: 12,
          }}
        >
          <dt style={{ opacity: 0.55 }}>Role</dt>
          <dd style={{ margin: 0 }}>{user.role}</dd>
          <dt style={{ opacity: 0.55 }}>Active</dt>
          <dd style={{ margin: 0 }}>{user.is_active ? "yes" : "no"}</dd>
          <dt style={{ opacity: 0.55 }}>ID</dt>
          <dd style={{ margin: 0, fontFamily: "ui-monospace, monospace" }}>
            {user.id}
          </dd>
        </dl>
        <button onClick={handleLogout} style={ghostButton}>
          Logout
        </button>
      </div>
    </main>
  );
}
