import { createAuthClient } from "better-auth/react";
import { useTranslations } from "next-intl";

export const authClient = createAuthClient({
  // /** The base URL of the server (optional if you're using the same domain) */
  // baseURL: "http://localhost:3000"
});

export type Session = typeof authClient.$Infer.Session;
export type User = Session["user"];

/** Better Auth error codes with their own message (`auth.errors.<key>`). */
const AUTH_ERROR_CODES = {
  USER_ALREADY_EXISTS: "userExists",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "userExists",
  INVALID_AVATAR: "invalidAvatar"
} as const;

export interface AuthError {
  status: number;
  code?: string;
  message?: string;
}

export type AuthErrorKey =
  | `auth.errors.${(typeof AUTH_ERROR_CODES)[keyof typeof AUTH_ERROR_CODES]}`
  | "auth.errors.invalidCredentials"
  | "auth.errors.tooManyAttempts";

/**
 * The message key for a Better Auth error, or null when it has none (then
 * show the error's own text). Better Auth answers in English, so known
 * codes and statuses are mapped to the app's messages.
 */
export function authErrorKey(error: AuthError): AuthErrorKey | null {
  const key = AUTH_ERROR_CODES[error.code as keyof typeof AUTH_ERROR_CODES];
  if (key) {
    return `auth.errors.${key}`;
  }
  if (error.status === 401) {
    return "auth.errors.invalidCredentials";
  }
  if (error.status === 429) {
    return "auth.errors.tooManyAttempts";
  }
  return null;
}

/**
 * A user-facing message for a Better Auth error, in the user's language.
 * The keys (`auth.errors.*`, `common.errors.generic`) are the app's
 * messages; anything unmapped falls back to the error's own text.
 */
export function useAuthErrorMessage() {
  const t = useTranslations();
  return (error: AuthError) => {
    const key = authErrorKey(error);
    if (key) {
      return t(key);
    }
    return error.message || t("common.errors.generic");
  };
}
