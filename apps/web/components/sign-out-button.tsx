"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, type ComponentProps } from "react";

import { Button } from "@/components/ui/button";
import { logoutSession } from "@/lib/auth";

export type SignOutButtonProps = {
  /** Where to navigate after cookies are cleared (default `/`). */
  redirectTo?: string;
  /** Button label when idle (default "Sign out"). */
  label?: string;
} & Pick<ComponentProps<typeof Button>, "variant" | "size" | "className">;

export function SignOutButton({
  redirectTo = "/",
  label = "Sign out",
  variant = "outline",
  size,
  className,
}: SignOutButtonProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const handleClick = useCallback(async () => {
    setPending(true);
    try {
      await logoutSession();
      router.replace(redirectTo);
      router.refresh();
    } finally {
      setPending(false);
    }
  }, [redirectTo, router]);

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      disabled={pending}
      onClick={handleClick}
    >
      {pending ? "Signing out…" : label}
    </Button>
  );
}
