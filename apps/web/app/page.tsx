import { cookies } from "next/headers";
import Link from "next/link";

import { DashboardShell } from "@/components/dashboard-shell";

/** Ensure `/` is never served from cache without fresh `cookies()` (post-login dashboard). */
export const dynamic = "force-dynamic";
import { Button } from "@/components/ui/button";
import { FMS_ACCESS_COOKIE } from "@/lib/cookies";

function AuthenticatedHome() {
  return (
    <div className="flex flex-1 flex-col">
      <section
        id="dashboard-timeline"
        className="scroll-mt-4 border-b border-border bg-muted/20 px-6 py-10 md:py-14"
      >
        <h2 className="text-lg font-semibold tracking-tight">Timeline</h2>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          Interactive month strip and filters will land here (dashboard home).
          Open the{" "}
          <Link href="/timeline" className="font-medium text-primary underline">
            full timeline
          </Link>{" "}
          page for the detailed activity feed today.
        </p>
      </section>
      <section className="flex flex-1 flex-col justify-center px-6 py-12">
        <p className="text-sm text-muted-foreground">
          Use the sidebar for Photos and Music. The dashboard layout continues on{" "}
          <Link href="/gallery" className="font-medium text-primary underline">
            Photos
          </Link>
          ,{" "}
          <Link href="/music" className="font-medium text-primary underline">
            Music
          </Link>
          , and{" "}
          <Link href="/me" className="font-medium text-primary underline">
            Profile
          </Link>
          .
        </p>
      </section>
    </div>
  );
}

export default async function HomePage() {
  const cookieStore = await cookies();
  const loggedIn = Boolean(cookieStore.get(FMS_ACCESS_COOKIE)?.value);

  if (loggedIn) {
    return (
      <DashboardShell>
        <AuthenticatedHome />
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
