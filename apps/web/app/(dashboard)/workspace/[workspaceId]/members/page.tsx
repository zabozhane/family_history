"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { ArrowLeft } from "lucide-react";

import { useWorkspace } from "@/components/workspace-context";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ApiRequestError, apiFetch } from "@/lib/api";
import type {
  UserRead,
  WorkspaceMemberRead,
  WorkspaceMembershipRole,
} from "@/lib/types";
import { cn } from "@/lib/utils";

function roleRank(r: WorkspaceMembershipRole): number {
  if (r === "owner") return 0;
  if (r === "editor") return 1;
  return 2;
}

function sortMembers(rows: WorkspaceMemberRead[]): WorkspaceMemberRead[] {
  return [...rows].sort((a, b) => {
    const d = roleRank(a.role) - roleRank(b.role);
    if (d !== 0) return d;
    return a.email.localeCompare(b.email);
  });
}

export default function WorkspaceMembersPage() {
  const params = useParams();
  const router = useRouter();
  const workspaceId =
    typeof params.workspaceId === "string" ? params.workspaceId : "";

  const { workspaces, ready, loading: wsLoading } = useWorkspace();
  const ws = workspaces.find((w) => w.id === workspaceId);

  const [members, setMembers] = useState<WorkspaceMemberRead[]>([]);
  const [me, setMe] = useState<UserRead | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    setError(null);
    try {
      const [memberRows, userMe] = await Promise.all([
        apiFetch<WorkspaceMemberRead[]>(
          `/api/v1/workspaces/${workspaceId}/members`,
        ),
        apiFetch<UserRead>("/api/v1/users/me"),
      ]);
      setMembers(sortMembers(memberRows));
      setMe(userMe);
    } catch (err) {
      if (err instanceof ApiRequestError && err.status === 401) {
        router.replace("/login");
        return;
      }
      setError(
        err instanceof ApiRequestError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to load members",
      );
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, [workspaceId, router]);

  useEffect(() => {
    if (!ready || !workspaceId || !ws) return;
    if (ws.membership_role !== "owner" || ws.kind !== "shared") return;
    void load();
  }, [ready, workspaceId, ws, load]);

  async function patchRole(memberUserId: string, role: "viewer" | "editor") {
    if (!workspaceId) return;
    setActingId(memberUserId);
    setError(null);
    try {
      const updated = await apiFetch<WorkspaceMemberRead>(
        `/api/v1/workspaces/${workspaceId}/members/${memberUserId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ role }),
        },
      );
      setMembers((prev) =>
        sortMembers(
          prev.map((m) => (m.user_id === memberUserId ? updated : m)),
        ),
      );
    } catch (err) {
      setError(
        err instanceof ApiRequestError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Could not update role",
      );
    } finally {
      setActingId(null);
    }
  }

  async function removeMember(memberUserId: string) {
    if (!workspaceId) return;
    if (
      !window.confirm(
        "Remove this person from the library? They will lose access immediately.",
      )
    ) {
      return;
    }
    setActingId(memberUserId);
    setError(null);
    try {
      await apiFetch(
        `/api/v1/workspaces/${workspaceId}/members/${memberUserId}`,
        {
          method: "DELETE",
        },
      );
      setMembers((prev) => prev.filter((m) => m.user_id !== memberUserId));
    } catch (err) {
      setError(
        err instanceof ApiRequestError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Could not remove member",
      );
    } finally {
      setActingId(null);
    }
  }

  if (!workspaceId) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-8">
        <p className="text-sm text-destructive">Invalid workspace.</p>
      </main>
    );
  }

  if (wsLoading || !ready) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-8">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </main>
    );
  }

  if (!ws) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Library not found</CardTitle>
            <CardDescription>
              You do not have access to this workspace or it does not exist.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link href="/">Back to dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (ws.membership_role !== "owner") {
    return (
      <main className="mx-auto max-w-2xl px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Members</CardTitle>
            <CardDescription>
              Only the library owner can view the workspace ID and manage members.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link href="/">Back to dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (ws.kind !== "shared") {
    return (
      <main className="mx-auto max-w-2xl px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Members</CardTitle>
            <CardDescription>
              Workspace ID and member management apply only to shared libraries. Personal
              libraries are private to you.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link href="/">Back to dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (error && members.length === 0 && !loading) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>{ws.name}</CardTitle>
            <CardDescription>Members</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
            <Button variant="outline" onClick={() => void load()}>
              Retry
            </Button>
            <Button asChild variant="ghost">
              <Link href="/">Back</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="-ml-2 gap-1 text-muted-foreground"
        >
          <Link href="/">
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Dashboard
          </Link>
        </Button>
        <h1 className="mt-2 text-xl font-semibold tracking-tight">{ws.name}</h1>
        <p className="text-sm text-muted-foreground">
          Manage who can view or edit this library.
        </p>
      </div>

      {error ? (
        <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Members</CardTitle>
          <CardDescription>
            {members.length}{" "}
            {members.length === 1 ? "person" : "people"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-0 divide-y divide-border px-0 pb-4 pt-0">
          {loading ? (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground">
              Loading members…
            </p>
          ) : members.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground">
              No members loaded.
            </p>
          ) : (
            members.map((m) => {
              const isSelf = me?.id === m.user_id;
              const isRowOwner = m.role === "owner";
              const busy = actingId === m.user_id;

              return (
                <div
                  key={m.user_id}
                  className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium leading-tight">
                      {m.display_name}
                      {isSelf ? (
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          (you)
                        </span>
                      ) : null}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">
                      {m.email}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
                    {isRowOwner ? (
                      <span className="rounded-md border border-border bg-muted/50 px-2.5 py-1 text-xs font-medium capitalize">
                        Owner
                      </span>
                    ) : (
                      <>
                        <label className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="sr-only">Role</span>
                          <select
                            className={cn(
                              "h-9 rounded-md border border-input bg-background px-2 text-sm capitalize",
                              busy && "opacity-60",
                            )}
                            disabled={busy}
                            value={m.role}
                            onChange={(e) => {
                              const v = e.target.value as "viewer" | "editor";
                              void patchRole(m.user_id, v);
                            }}
                          >
                            <option value="viewer">Viewer</option>
                            <option value="editor">Editor</option>
                          </select>
                        </label>
                        {!isSelf ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                            disabled={busy}
                            onClick={() => void removeMember(m.user_id)}
                          >
                            {busy ? "…" : "Remove"}
                          </Button>
                        ) : null}
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </main>
  );
}
