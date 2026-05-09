"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SignOutButton } from "@/components/sign-out-button";
import { ApiRequestError, apiFetch } from "@/lib/api";
import type { UserRead } from "@/lib/types";

export default function MePage() {
  const router = useRouter();
  const [user, setUser] = useState<UserRead | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    apiFetch<UserRead>("/api/v1/users/me")
      .then((data) => {
        if (active) setUser(data);
      })
      .catch((err) => {
        if (!active) return;
        if (err instanceof ApiRequestError && err.status === 401) {
          router.replace("/login");
          return;
        }
        setError(err instanceof Error ? err.message : "Failed to load profile");
      });
    return () => {
      active = false;
    };
  }, [router]);

  if (error) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>Something went wrong.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
            <SignOutButton redirectTo="/login" />
          </CardContent>
        </Card>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">Loading…</p>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{user.display_name}</CardTitle>
          <CardDescription>{user.email}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Role</dt>
            <dd>{user.role}</dd>
            <dt className="text-muted-foreground">Active</dt>
            <dd>{user.is_active ? "yes" : "no"}</dd>
            <dt className="text-muted-foreground">ID</dt>
            <dd className="font-mono text-xs">{user.id}</dd>
          </dl>
          <SignOutButton redirectTo="/login" />
        </CardContent>
      </Card>
    </main>
  );
}
