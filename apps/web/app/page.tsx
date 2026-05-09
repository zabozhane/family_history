import { cookies } from "next/headers";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { SignOutButton } from "@/components/sign-out-button";
import { FMS_ACCESS_COOKIE } from "@/lib/cookies";

export default async function HomePage() {
  const cookieStore = await cookies();
  const loggedIn = Boolean(cookieStore.get(FMS_ACCESS_COOKIE)?.value);

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
          {!loggedIn ? (
            <>
              <Button variant="secondary" asChild>
                <Link href="/login">Sign in</Link>
              </Button>
              <Button variant="secondary" asChild>
                <Link href="/register">Create account</Link>
              </Button>
            </>
          ) : null}
          <Button variant="outline" asChild>
            <Link href="/me">My profile</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/timeline">Timeline</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/gallery">Photos</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/music">Music</Link>
          </Button>
          {loggedIn ? <SignOutButton redirectTo="/" /> : null}
        </div>
      </div>
    </main>
  );
}
