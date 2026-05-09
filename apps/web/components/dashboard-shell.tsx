"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { SignOutButton } from "@/components/sign-out-button";
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
    href: "/music",
    label: "Music",
    activeMatch: (p) => p === "/music" || p.startsWith("/music/"),
  },
];

export function DashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen w-full bg-background">
      <aside
        className="flex w-[220px] shrink-0 flex-col border-r border-border bg-muted/40"
        aria-label="Workspace"
      >
        <div className="border-b border-border px-4 py-4">
          <Link
            href="/"
            className="block text-sm font-semibold tracking-tight text-foreground hover:underline"
          >
            {PROJECT_TITLE}
          </Link>
          <p className="mt-1 text-xs text-muted-foreground">Family workspace</p>
        </div>
        <nav
          className="flex flex-1 flex-col gap-0.5 px-2 py-3"
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
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
