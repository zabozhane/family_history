"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { ApiRequestError, apiFetch } from "@/lib/api";
import type { WorkspaceCreate, WorkspaceRead } from "@/lib/types";

const STORAGE_KEY = "fms_active_workspace_id";

type WorkspaceContextValue = {
  workspaces: WorkspaceRead[];
  activeWorkspaceId: string | null;
  activeWorkspace: WorkspaceRead | null;
  loading: boolean;
  error: string | null;
  creating: boolean;
  ready: boolean;
  setActiveWorkspaceId: (id: string) => void;
  refreshWorkspaces: () => Promise<void>;
  createWorkspace: (body: WorkspaceCreate) => Promise<void>;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

function pickInitialId(
  list: WorkspaceRead[],
  stored: string | null,
): string | null {
  if (list.length === 0) return null;
  if (stored && list.some((w) => w.id === stored)) return stored;
  return list[0]?.id ?? null;
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [workspaces, setWorkspaces] = useState<WorkspaceRead[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceIdState] = useState<
    string | null
  >(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await apiFetch<WorkspaceRead[]>("/api/v1/workspaces");
      setWorkspaces(list);
      const stored =
        typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
      const initial = pickInitialId(list, stored);
      setActiveWorkspaceIdState(initial);
      if (initial && typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEY, initial);
      }
    } catch (err) {
      setError(
        err instanceof ApiRequestError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to load workspaces",
      );
      setWorkspaces([]);
      setActiveWorkspaceIdState(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const setActiveWorkspaceId = useCallback((id: string) => {
    setActiveWorkspaceIdState(id);
    localStorage.setItem(STORAGE_KEY, id);
  }, []);

  const refreshWorkspaces = useCallback(async () => {
    await load();
  }, [load]);

  const createWorkspace = useCallback(
    async (body: WorkspaceCreate) => {
      setCreating(true);
      setError(null);
      try {
        const ws = await apiFetch<WorkspaceRead>("/api/v1/workspaces", {
          method: "POST",
          body: JSON.stringify(body),
        });
        setWorkspaces((prev) => {
          const next = [...prev, ws];
          next.sort(
            (a, b) =>
              new Date(a.created_at).getTime() -
              new Date(b.created_at).getTime(),
          );
          return next;
        });
        setActiveWorkspaceId(ws.id);
      } catch (err) {
        setError(
          err instanceof ApiRequestError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Failed to create workspace",
        );
        throw err;
      } finally {
        setCreating(false);
      }
    },
    [setActiveWorkspaceId],
  );

  const activeWorkspace = useMemo(
    () => workspaces.find((w) => w.id === activeWorkspaceId) ?? null,
    [workspaces, activeWorkspaceId],
  );

  const ready = useMemo(
    () =>
      !loading &&
      (activeWorkspaceId !== null || workspaces.length === 0),
    [loading, activeWorkspaceId, workspaces.length],
  );

  const value = useMemo(
    () => ({
      workspaces,
      activeWorkspaceId,
      activeWorkspace,
      loading,
      error,
      creating,
      ready,
      setActiveWorkspaceId,
      refreshWorkspaces,
      createWorkspace,
    }),
    [
      workspaces,
      activeWorkspaceId,
      activeWorkspace,
      loading,
      error,
      creating,
      ready,
      setActiveWorkspaceId,
      refreshWorkspaces,
      createWorkspace,
    ],
  );

  return (
    <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
  );
}

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error("useWorkspace must be used within WorkspaceProvider");
  }
  return ctx;
}
