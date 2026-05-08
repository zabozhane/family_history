"use client";

// TODO(T12): rebuild on shadcn/ui (Form, Input, Button) + react-hook-form + zod.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { ApiRequestError, apiFetch } from "../../lib/api";
import { saveTokens } from "../../lib/auth";
import {
  card,
  errorBox,
  heading,
  input,
  label,
  link,
  pageWrap,
  primaryButton,
  subtle,
} from "../../lib/styles";
import type { TokenResponse } from "../../lib/types";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const tokens = await apiFetch<TokenResponse>(
        "/api/v1/auth/login",
        {
          method: "POST",
          body: JSON.stringify({ email, password }),
        },
        { auth: false },
      );
      saveTokens(tokens.access_token, tokens.refresh_token);
      router.push("/me");
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
      } else {
        setError("Network error");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main style={pageWrap}>
      <form onSubmit={handleSubmit} style={card}>
        <h1 style={heading}>Welcome back</h1>
        <p style={subtle}>Sign in to your family workspace.</p>

        {error && <div style={errorBox}>{error}</div>}

        <label style={label} htmlFor="email">
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={input}
        />

        <label style={label} htmlFor="password">
          Password
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={input}
        />

        <button type="submit" disabled={submitting} style={primaryButton}>
          {submitting ? "Signing in…" : "Sign in"}
        </button>

        <p style={{ marginTop: "1rem", fontSize: "0.85rem", opacity: 0.7 }}>
          New here?{" "}
          <Link href="/register" style={link}>
            Create an account
          </Link>
        </p>
      </form>
    </main>
  );
}
