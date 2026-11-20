"use server";

import { refresh } from "next/cache";
import { getCurrentUser, isAdmin } from "@/lib/session";
import { dropImportedTable } from "@/lib/user-tables";

export type DropTableResult =
  | { ok: true }
  | { ok: false; error: "forbidden" | "notFound" | "failed" };

/** Drops a table created from an upload (admins only). */
export async function dropTable(tableName: string): Promise<DropTableResult> {
  // Server actions are public endpoints: check the role like the page does.
  if (!isAdmin(await getCurrentUser())) {
    return { ok: false, error: "forbidden" };
  }
  try {
    if (!dropImportedTable(tableName)) {
      return { ok: false, error: "notFound" };
    }
  } catch (error) {
    console.error(error);
    return { ok: false, error: "failed" };
  }
  refresh();
  return { ok: true };
}
