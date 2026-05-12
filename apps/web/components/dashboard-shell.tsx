"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { MusicPlayerDock, useMusicPlayer } from "@/components/music-player-context";
import { SignOutButton } from "@/components/sign-out-button";
import { WorkspaceProvider } from "@/components/workspace-context";
import { WorkspaceSwitcher } from "@/components/workspace-switcher";
import { cn } from "@/lib/utils";

const PROJECT_TITLE = "Family Media";

type NavItem = {
  href: string;
  label: string;
  activeMatch: (pathname: string) => boolean;
};

const primaryNav: NavItem[] = [
  {
    href: "/#dashboard-timeline",
    label: "Timeline",
    activeMatch: (p) => p === "/" || p === "/timeline",
  },
  {
    href: "/gallery",
    label: "Photos",
    activeMatch: (p) => p === "/gallery" || p.startsWith("/gallery/"),
  },
  {
    href: "/video",
    label: "Video",
    activeMatch: (p) => p === "/video" || p.startsWith("/video/"),
  },
  {
    href: "/music",
    label: "Music",
    activeMatch: (p) => p === "/music" || p.startsWith("/music/"),
  },
];

export function DashboardShell({ children }: { children: ReactNode }) {
  return (
    <WorkspaceProvider>
      <DashboardShellInner>{children}</DashboardShellInner>
    </WorkspaceProvider>
  );
}

function DashboardShellInner({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { playerVisible, queue } = useMusicPlayer();
  const reserveDockSpace =
    playerVisible && queue.length > 0;

  return (
    <div className="flex h-dvh max-h-dvh min-h-0 w-full overflow-hidden bg-background">
      <aside
        className="flex h-full min-h-0 w-[220px] shrink-0 flex-col overflow-hidden border-r border-border bg-muted/40"
        aria-label="Workspace"
      >
        <div className="border-b border-border px-4 py-4">
          <Link
            href="/"
            className="block text-sm font-semibold tracking-tight text-foreground hover:underline"
          >
            {PROJECT_TITLE}
          </Link>
          <div className="mt-3">
            <WorkspaceSwitcher />
          </div>
        </div>
        <nav
          className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2 py-3"
          aria-label="Primary"
        >
          {primaryNav.map((item) => {
            const active = item.activeMatch(pathname);
            return (
              <Link
                key={item.label}
                href={item.href}
                className={cn(
                  "rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
                  active
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground",
                )}
              >
                {item.label}
              </Link>
            );
          })}
          <Link
            href="/me"
            className={cn(
              "rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
              pathname === "/me" || pathname.startsWith("/me/")
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground",
            )}
          >
            Profile
          </Link>
        </nav>
        <div className="mt-auto border-t border-border p-3">
          <SignOutButton
            redirectTo="/"
            label="Log out"
            variant="outline"
            className="w-full"
          />
        </div>
      </aside>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div
          className={cn(
            "min-h-0 flex-1 overflow-y-auto",
            reserveDockSpace && "pb-[4.75rem]",
          )}
        >
          {children}
        </div>
        <MusicPlayerDock />
      </div>
    </div>
  );
}

