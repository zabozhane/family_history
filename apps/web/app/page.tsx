import { cookies } from "next/headers";
import Link from "next/link";

import { DashboardHome } from "@/components/dashboard-home";
import { DashboardShell } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { FMS_ACCESS_COOKIE } from "@/lib/cookies";

/** Ensure `/` is never served from cache without fresh `cookies()` (post-login dashboard). */
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const cookieStore = await cookies();
  const loggedIn = Boolean(cookieStore.get(FMS_ACCESS_COOKIE)?.value);

  if (loggedIn) {
    return (
      <DashboardShell>
        <DashboardHome />
      </DashboardShell>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="mb-3 text-3xl font-semibold tracking-tight">
          Family Media System
        </h1>
        <p className="mb-8 text-muted-foreground">
          Private family media + digital memory platform.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button variant="secondary" asChild>
            <Link href="/login">Sign in</Link>
          </Button>
          <Button variant="secondary" asChild>
            <Link href="/register">Create account</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
