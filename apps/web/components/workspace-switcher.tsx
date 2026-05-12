"use client";

import Link from "next/link";
import { useState } from "react";

import { Clock, Info, Plus, Users } from "lucide-react";

import { NotificationsBell } from "@/components/notifications-bell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useWorkspace } from "@/components/workspace-context";
import { ApiRequestError, apiFetch } from "@/lib/api";
import type { WorkspaceKind } from "@/lib/types";
import { cn, parseUuid } from "@/lib/utils";

function kindLabel(k: WorkspaceKind): string {
  return k === "personal" ? "Personal" : "Shared";
}

type ModalTab = "create" | "join";

export function WorkspaceSwitcher() {
  const {
    workspaces,
    outgoingJoinRequests,
    activeWorkspaceId,
    setActiveWorkspaceId,
    loading,
    error,
    creating,
    createWorkspace,
    refreshWorkspaces,
  } = useWorkspace();

  const pendingOutgoing = outgoingJoinRequests.filter(
    (jr) => jr.status === "pending",
  );

  const [dialogOpen, setDialogOpen] = useState(false);
  const [modalTab, setModalTab] = useState<ModalTab>("create");
  const [infoOpenId, setInfoOpenId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  const [newKind, setNewKind] = useState<WorkspaceKind>("personal");
  const [createError, setCreateError] = useState<string | null>(null);

  const [joinWorkspaceId, setJoinWorkspaceId] = useState("");
  const [joinSubmitting, setJoinSubmitting] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joinSuccess, setJoinSuccess] = useState<string | null>(null);

  async function handleCreate() {
    const name = newName.trim();
    if (!name) {
      setCreateError("Enter a name.");
      return;
    }
    setCreateError(null);
    try {
      await createWorkspace({ name, kind: newKind });
      setNewName("");
      setNewKind("personal");
      setDialogOpen(false);
    } catch {
      /* context sets error */
    }
  }

  async function handleJoinRequest() {
    const wid = parseUuid(joinWorkspaceId);
    if (!wid) {
      setJoinError("Enter a valid workspace ID (UUID).");
      return;
    }
    setJoinError(null);
    setJoinSuccess(null);
    setJoinSubmitting(true);
    try {
      await apiFetch(`/api/v1/workspaces/${wid}/join-requests`, {
        method: "POST",
        body: "{}",
      });
      await refreshWorkspaces();
      setJoinSuccess(
        "Request sent. It appears below with a pending icon until the owner responds.",
      );
      setJoinWorkspaceId("");
    } catch (err) {
      setJoinError(
        err instanceof ApiRequestError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Could not send request",
      );
    } finally {
      setJoinSubmitting(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Library
        </p>
        <div className="flex shrink-0 items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            aria-label="Add or join workspace"
            disabled={loading || creating || joinSubmitting}
            onClick={() => {
              setCreateError(null);
              setJoinError(null);
              setJoinSuccess(null);
              setModalTab("create");
              setDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : (
        <ul className="max-h-[40vh] space-y-0.5 overflow-y-auto pr-0.5">
          {workspaces.map((ws) => {
            const selected = ws.id === activeWorkspaceId;
            return (
              <li
                key={ws.id}
                className={cn(
                  "overflow-hidden rounded-md border border-transparent",
                  selected && "border-border bg-accent text-accent-foreground",
                )}
              >
                <div className="flex items-stretch gap-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveWorkspaceId(ws.id);
                      setInfoOpenId(null);
                    }}
                    className={cn(
                      "flex min-w-0 flex-1 flex-col items-start justify-center px-2 py-1.5 text-left text-sm transition-colors",
                      selected
                        ? "text-accent-foreground"
                        : "text-muted-foreground hover:bg-muted/80 hover:text-foreground",
                    )}
                  >
                    <span className="w-full truncate font-medium">{ws.name}</span>
                    <span
                      className={cn(
                        "text-[10px] opacity-80",
                        selected && "opacity-90",
                      )}
                    >
                      {kindLabel(ws.kind)} · {ws.membership_role}
                    </span>
                  </button>
                  <div className="flex shrink-0 items-center gap-0.5 self-stretch pr-0.5">
                    {ws.kind === "shared" ? (
                      <NotificationsBell
                        workspaceId={ws.id}
                        workspaceName={ws.name}
                      />
                    ) : null}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className={cn(
                        "h-7 w-7 shrink-0",
                        selected
                          ? "text-accent-foreground hover:bg-accent-foreground/15"
                          : "text-muted-foreground",
                      )}
                      aria-label={`Workspace ID: ${ws.name}`}
                      aria-expanded={infoOpenId === ws.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setInfoOpenId((id) => (id === ws.id ? null : ws.id));
                      }}
                    >
                      <Info className="h-4 w-4" aria-hidden />
                    </Button>
                  </div>
                </div>
                {infoOpenId === ws.id ? (
                  <div className="border-t border-border/60 bg-muted/40 px-2 py-2 text-[11px] text-muted-foreground">
                    <p className="mb-1.5 leading-snug">
                      Copy this ID and send it to someone who should{" "}
                      <strong className="font-medium text-foreground">
                        request access
                      </strong>
                      . Only{" "}
                      <strong className="font-medium text-foreground">shared</strong>{" "}
                      libraries accept join requests.
                    </p>
                    <code className="block break-all font-mono text-[10px] leading-relaxed text-foreground">
                      {ws.id}
                    </code>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="mt-2 h-7 w-full text-xs"
                      onClick={() => {
                        void navigator.clipboard.writeText(ws.id).then(() => {
                          setCopiedId(ws.id);
                          window.setTimeout(() => {
                            setCopiedId((x) => (x === ws.id ? null : x));
                          }, 2000);
                        });
                      }}
                    >
                      {copiedId === ws.id ? "Copied" : "Copy ID"}
                    </Button>
                    <Button asChild variant="outline" size="sm" className="mt-1.5 h-8 w-full text-xs">
                      <Link href={`/workspace/${ws.id}/members`}>
                        <Users className="h-3.5 w-3.5" aria-hidden />
                        Members
                      </Link>
                    </Button>
                    {ws.membership_role === "owner" ? (
                      <p className="mt-1.5 text-[10px] leading-snug text-muted-foreground">
                        As owner you can change roles or remove members on that page.
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {!loading && !error && pendingOutgoing.length > 0 ? (
        <div className="mt-3 border-t border-border/80 pt-3">
          <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Pending access
          </p>
          <ul className="space-y-0.5">
            {pendingOutgoing.map((jr) => (
              <li
                key={jr.id}
                className="rounded-md border border-dashed border-border/80 bg-muted/30 px-2 py-1.5"
              >
                <div className="flex items-start gap-2">
                  <span
                    className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-background text-amber-600 dark:text-amber-400"
                    title="Waiting for the owner to approve your request"
                  >
                    <Clock className="h-4 w-4" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <p className="truncate text-sm font-medium leading-tight">
                      {jr.workspace_name}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      Awaiting approval
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {dialogOpen ? (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ws-modal-title"
          onClick={(e) => {
            if (
              e.target === e.currentTarget &&
              !creating &&
              !joinSubmitting
            ) {
              setDialogOpen(false);
            }
          }}
        >
          <div className="w-full max-w-md rounded-xl border border-border bg-background p-6 shadow-xl">
            <h2 id="ws-modal-title" className="text-base font-semibold">
              Library workspace
            </h2>

            <div
              className="mt-4 flex rounded-lg border border-border bg-muted/40 p-0.5"
              role="tablist"
              aria-label="Workspace action"
            >
              <button
                type="button"
                role="tab"
                aria-selected={modalTab === "create"}
                className={cn(
                  "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  modalTab === "create"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => setModalTab("create")}
              >
                Create new
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={modalTab === "join"}
                className={cn(
                  "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  modalTab === "join"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => setModalTab("join")}
              >
                Join existing
              </button>
            </div>

            {modalTab === "create" ? (
              <div className="mt-4 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="ws-name">Name</Label>
                  <Input
                    id="ws-name"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Family archive"
                    disabled={creating}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ws-kind">Kind</Label>
                  <select
                    id="ws-kind"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={newKind}
                    disabled={creating}
                    onChange={(e) =>
                      setNewKind(e.target.value as WorkspaceKind)
                    }
                  >
                    <option value="personal">Personal</option>
                    <option value="shared">Shared</option>
                  </select>
                </div>
                {createError ? (
                  <p className="text-sm text-destructive">{createError}</p>
                ) : null}
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                <p className="text-xs text-muted-foreground">
                  Ask the workspace owner for the shared library ID, paste it here,
                  and send a join request. Only <strong className="font-medium text-foreground">shared</strong> libraries accept requests.
                </p>
                <div className="space-y-2">
                  <Label htmlFor="ws-join-id">Workspace ID</Label>
                  <Input
                    id="ws-join-id"
                    value={joinWorkspaceId}
                    onChange={(e) => setJoinWorkspaceId(e.target.value)}
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    disabled={joinSubmitting}
                    autoComplete="off"
                  />
                </div>
                {joinError ? (
                  <p className="text-sm text-destructive">{joinError}</p>
                ) : null}
                {joinSuccess ? (
                  <p className="text-sm text-muted-foreground">{joinSuccess}</p>
                ) : null}
              </div>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={creating || joinSubmitting}
                onClick={() => setDialogOpen(false)}
              >
                Close
              </Button>
              {modalTab === "create" ? (
                <Button
                  type="button"
                  disabled={creating}
                  onClick={() => void handleCreate()}
                >
                  {creating ? "Creating…" : "Create"}
                </Button>
              ) : (
                <Button
                  type="button"
                  disabled={joinSubmitting}
                  onClick={() => void handleJoinRequest()}
                >
                  {joinSubmitting ? "Sending…" : "Send request"}
                </Button>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
