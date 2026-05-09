/** Clear session cookies via the Next.js route handler (tokens stay httpOnly). */
export async function logoutSession(): Promise<void> {
  await fetch("/api/session/logout", {
    method: "POST",
    credentials: "include",
  });
}
