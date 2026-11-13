import { createSessionHelpers } from "./auth.server";

/** The signed-in user (or null) and the guard for protected pages. */
export const { getCurrentUser, requireUser } = createSessionHelpers({
  backendUrl: process.env.BETTER_AUTH_URL!,
  appUrl: process.env.BETTER_AUTH_URL!,
});

export const isAdmin = (user: User | null) => user?.role === "admin";
