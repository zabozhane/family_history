"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { Bell } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/components/workspace-context";
import { ApiRequestError, apiFetch } from "@/lib/api";
import {
  NOTIFICATION_KIND_JOIN_REQUEST_APPROVED,
  NOTIFICATION_KIND_JOIN_REQUEST_PENDING,
  type NotificationRead,
} from "@/lib/types";
import { cn } from "@/lib/utils";

function formatWhen(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export type NotificationsBellProps = {
  workspaceId: string;
  workspaceName?: string;
};

export function NotificationsBell({
  workspaceId,
  workspaceName,
}: NotificationsBellProps) {
  const { refreshWorkspaces } = useWorkspace();

  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [items, setItems] = useState<NotificationRead[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);
  const [approveRole, setApproveRole] = useState<Record<string, "viewer" | "editor">>(
    {},
  );
  const wrapRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ workspace_id: workspaceId });
      const rows = await apiFetch<NotificationRead[]>(
        `/api/v1/notifications?${qs.toString()}`,
      );
      setItems(rows);
      setApproveRole((prev) => {
        const next = { ...prev };
        for (const n of rows) {
          if (
            n.kind === NOTIFICATION_KIND_JOIN_REQUEST_PENDING &&
            n.join_request &&
            next[n.join_request.id] === undefined
          ) {
            next[n.join_request.id] = "viewer";
          }
        }
        return next;
      });
    } catch (err) {
      setError(
        err instanceof ApiRequestError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to load notifications",
      );
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!open) return;
    void load();
  }, [open, load]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onDocPointerDown(e: MouseEvent | PointerEvent) {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener("pointerdown", onDocPointerDown);
    return () => document.removeEventListener("pointerdown", onDocPointerDown);
  }, [open]);

  const unread = items.filter((n) => n.read_at === null).length;

  async function markRead(id: string, kind: string) {
    try {
      await apiFetch<NotificationRead>(`/api/v1/notifications/${id}/read`, {
        method: "PATCH",
      });
      if (kind === NOTIFICATION_KIND_JOIN_REQUEST_APPROVED) {
        await refreshWorkspaces();
      }
      await load();
    } catch {
      await load();
    }
  }

  async function respond(
    workspaceId: string,
    requestId: string,
    action: "approve" | "reject",
    role?: "viewer" | "editor",
  ) {
    setActingId(requestId);
    setError(null);
    try {
      const body =
        action === "approve"
          ? { action: "approve" as const, role: role ?? "viewer" }
          : { action: "reject" as const };
      await apiFetch(
        `/api/v1/workspaces/${workspaceId}/join-requests/${requestId}/respond`,
        {
          method: "POST",
          body: JSON.stringify(body),
        },
      );
      await load();
    } catch (err) {
      setError(
        err instanceof ApiRequestError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Action failed",
      );
    } finally {
      setActingId(null);
    }
  }

  const panel = open ? (
    <>
      <div
        className="fixed inset-0 z-[180] touch-none bg-neutral-950/75"
        aria-hidden
        onClick={() => setOpen(false)}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={
          workspaceName
            ? `Notifications — ${workspaceName}`
            : "Notifications"
        }
        className={cn(
          "fixed z-[190] flex max-h-[min(85vh,32rem)] flex-col overflow-hidden rounded-xl border border-border bg-background text-foreground shadow-2xl ring-1 ring-border",
          "inset-x-3 top-14 max-w-none sm:inset-x-auto sm:left-auto sm:right-4 sm:top-16 sm:w-[min(22rem,calc(100vw-2rem))]",
        )}
      >
        <div className="shrink-0 border-b border-border bg-background px-3 py-2">
          <p className="text-sm font-semibold">Notifications</p>
          {workspaceName ? (
            <p className="truncate text-xs text-muted-foreground">{workspaceName}</p>
          ) : null}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
          {loading && items.length === 0 ? (
            <p className="px-2 py-4 text-xs text-muted-foreground">Loading…</p>
          ) : null}
          {error ? (
            <p className="px-2 py-2 text-xs text-destructive">{error}</p>
          ) : null}
          {!loading && items.length === 0 && !error ? (
            <p className="px-2 py-4 text-xs text-muted-foreground">
              No notifications for this library yet.
            </p>
          ) : null}
          <ul className="space-y-2">
            {items.map((n) => {
              const jr = n.join_request;
              const isPendingJoin =
                n.kind === NOTIFICATION_KIND_JOIN_REQUEST_PENDING &&
                jr &&
                jr.status === "pending";
              const rid = jr?.id ?? "";
              const role = approveRole[rid] ?? "viewer";

              return (
                <li
                  key={n.id}
                  className={cn(
                    "rounded-md border border-border bg-card p-2.5 text-sm",
                    n.read_at === null && "border-primary/40 bg-muted",
                  )}
                >
                  <p className="font-medium leading-snug">{n.title}</p>
                  {n.body ? (
                    <p className="mt-1 text-xs text-muted-foreground">{n.body}</p>
                  ) : null}
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {formatWhen(n.created_at)}
                  </p>

                  {isPendingJoin && jr ? (
                    <div className="mt-2 space-y-2 border-t border-border pt-2">
                      <div className="text-xs">
                        <p className="font-medium">{jr.requester.display_name}</p>
                        <p className="text-muted-foreground">{jr.requester.email}</p>
                        <p className="mt-1 text-muted-foreground">
                          Workspace:{" "}
                          <span className="font-medium">{jr.workspace_name}</span>
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          Role if approved
                          <select
                            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                            value={role}
                            disabled={actingId === jr.id}
                            onChange={(e) =>
                              setApproveRole((prev) => ({
                                ...prev,
                                [jr.id]: e.target.value as "viewer" | "editor",
                              }))
                            }
                          >
                            <option value="viewer">Viewer</option>
                            <option value="editor">Editor</option>
                          </select>
                        </label>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs"
                          disabled={actingId === jr.id}
                          onClick={() =>
                            void respond(jr.workspace_id, jr.id, "reject")
                          }
                        >
                          Decline
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          className="h-8 text-xs"
                          disabled={actingId === jr.id}
                          onClick={() =>
                            void respond(
                              jr.workspace_id,
                              jr.id,
                              "approve",
                              role,
                            )
                          }
                        >
                          {actingId === jr.id ? "…" : "Approve"}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="h-8 w-full text-xs"
                        disabled={n.read_at !== null}
                        onClick={() => void markRead(n.id, n.kind)}
                      >
                        {n.read_at === null ? "Mark as read" : "Read"}
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </>
  ) : null;

  return (
    <>
      <div className="relative shrink-0" ref={wrapRef}>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="relative h-7 w-7 shrink-0"
          aria-label="Notifications"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <Bell className="h-4 w-4" aria-hidden />
          {unread > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
              {unread > 99 ? "99+" : unread}
            </span>
          ) : null}
        </Button>
      </div>
      {mounted && open && panel ? createPortal(panel, document.body) : null}
    </>
  );
}
