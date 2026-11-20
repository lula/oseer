import { authDb } from "./auth";

export interface UserSummary {
  id: string;
  name: string;
  email: string;
}

/**
 * Names and emails of users by id, read from the auth database. Ids with no
 * user (deleted since) are missing from the map.
 */
export function findUsers(ids: readonly string[]): Map<string, UserSummary> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map();
  const rows = authDb
    .prepare(
      `SELECT id, name, email FROM "user" WHERE id IN (${unique.map(() => "?").join(", ")})`,
    )
    .all(...unique) as UserSummary[];
  return new Map(rows.map((user) => [user.id, user]));
}
