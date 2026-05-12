"use client";

import { useState } from "react";

import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useWorkspace } from "@/components/workspace-context";
import type { WorkspaceKind } from "@/lib/types";
import { cn } from "@/lib/utils";

function kindLabel(k: WorkspaceKind): string {
  return k === "personal" ? "Personal" : "Shared";
}

export function WorkspaceSwitcher() {
  const {
    workspaces,
    activeWorkspaceId,
    setActiveWorkspaceId,
    loading,
    error,
    creating,
    createWorkspace,
  } = useWorkspace();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newKind, setNewKind] = useState<WorkspaceKind>("personal");
  const [createError, setCreateError] = useState<string | null>(null);

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

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Library
        </p>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          aria-label="New workspace"
          disabled={loading || creating}
          onClick={() => {
            setCreateError(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="h-4 w-4" aria-hidden />
        </Button>
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
              <li key={ws.id}>
                <button
                  type="button"
                  onClick={() => setActiveWorkspaceId(ws.id)}
                  className={cn(
                    "flex w-full flex-col items-start rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                    selected
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-muted/80 hover:text-foreground",
                  )}
                >
                  <span className="w-full truncate font-medium">{ws.name}</span>
                  <span className="text-[10px] opacity-80">
                    {kindLabel(ws.kind)} · {ws.membership_role}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {dialogOpen ? (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-ws-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !creating) setDialogOpen(false);
          }}
        >
          <div className="w-full max-w-md rounded-xl border border-border bg-background p-6 shadow-xl">
            <h2 id="new-ws-title" className="text-base font-semibold">
              New workspace
            </h2>
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
            <div className="mt-6 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={creating}
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={creating}
                onClick={() => void handleCreate()}
              >
                {creating ? "Creating…" : "Create"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
