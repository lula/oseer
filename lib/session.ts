import { notFound } from "next/navigation";
import type { User } from "./auth-client";
import { createSessionHelpers } from "./auth.server";

/** The signed-in user (or null) and the guard for protected pages. */
export const { getCurrentUser, requireUser } = createSessionHelpers({
  backendUrl: process.env.BETTER_AUTH_URL!,
  appUrl: process.env.BETTER_AUTH_URL!,
});

export const isAdmin = (user: User | null) => user?.role === "admin";

/**
 * Returns the signed-in admin. For anyone else, renders the 404 page, so
 * admin pages don't reveal that they exist. Reads the session: call it
 * inside a Suspense boundary.
 */
export async function requireAdmin(): Promise<User> {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user)) {
    notFound();
  }
  return user;
}
