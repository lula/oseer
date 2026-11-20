"use server";

import { readUploadedSheet } from "@/lib/excel.server";
import { getCurrentUser, isAdmin } from "@/lib/session";
import type { Row } from "read-excel-file/universal";
import {
  checkSheetKey,
  createTableFromSheet,
  KeyError,
  planTable,
  type CreatedTable,
  type KeyCheck,
  type TablePlan,
} from "@/lib/user-tables";

/** How many rows the plan sends back for the preview. */
const PREVIEW_ROWS = 10;

type Failure = "forbidden" | "notFound" | "invalidFile" | "noHeader" | "failed";

/** What the table would look like, for the steps to show. */
export interface UploadPlan extends TablePlan {
  sheet: string;
  header: Row;
  previewRows: Row[];
  rows: number;
}

export type PlanResult = { ok: true; plan: UploadPlan } | { ok: false; error: Failure };

export type KeyCheckResult = ({ ok: true } & KeyCheck) | { ok: false; error: Failure };

async function isAllowed() {
  // Server actions are public endpoints: check the role like the page does.
  return isAdmin(await getCurrentUser());
}

/**
 * The table an uploaded .xlsx would become (name, columns, types), with
 * its first rows. Writes nothing; the file is read on the server.
 */
export async function planTableFromUpload(
  uploadId: string,
  fileName: string,
): Promise<PlanResult> {
  if (!(await isAllowed())) return { ok: false, error: "forbidden" };
  const sheet = await readUploadedSheet(uploadId);
  if (!sheet.ok) return sheet;
  if (sheet.header.length === 0) return { ok: false, error: "noHeader" };
  return {
    ok: true,
    plan: {
      ...planTable(fileName, sheet.header, sheet.rows),
      sheet: sheet.sheet,
      header: sheet.header,
      previewRows: sheet.rows.slice(0, PREVIEW_ROWS),
      rows: sheet.rows.length,
    },
  };
}

/**
 * Whether the header cells `keyIndexes` (0-based) can be the primary key:
 * the rows where they're empty or repeat. No key: always fine.
 */
export async function checkKeyForUpload(
  uploadId: string,
  keyIndexes: number[],
): Promise<KeyCheckResult> {
  if (!(await isAllowed())) return { ok: false, error: "forbidden" };
  const sheet = await readUploadedSheet(uploadId);
  if (!sheet.ok) return sheet;
  try {
    return { ok: true, ...checkSheetKey(sheet.header, sheet.rows, keyIndexes) };
  } catch (error) {
    console.error(error);
    return { ok: false, error: "failed" };
  }
}

export type CreateTableResult =
  | ({ ok: true } & CreatedTable)
  | ({ ok: false; error: "keys" } & KeyCheck)
  | { ok: false; error: "forbidden" | "notFound" | "invalidFile" | "failed" };

/**
 * Creates a database table from the first sheet of an uploaded .xlsx: the
 * header row gives the columns, the other rows the data. The file is read
 * again on the server, so the browser can't send different data.
 *
 * `keyIndexes`: the header cells (0-based) forming the primary key.
 */
export async function createTableFromUpload(
  uploadId: string,
  fileName: string,
  keyIndexes: number[] = [],
): Promise<CreateTableResult> {
  // Server actions are public endpoints: check the role like the page does.
  const user = await getCurrentUser();
  if (!user || !isAdmin(user)) {
    return { ok: false, error: "forbidden" };
  }
  const sheet = await readUploadedSheet(uploadId);
  if (!sheet.ok) return sheet;

  try {
    // Named after the file the user picked ("Sales 2024.xlsx" → sales_2024).
    const created = createTableFromSheet(
      { uploadId, fileName, sheet: sheet.sheet, userId: user.id },
      sheet.header,
      sheet.rows,
      keyIndexes,
    );
    return { ok: true, ...created };
  } catch (error) {
    if (error instanceof KeyError) return { ok: false, error: "keys", ...error.check };
    console.error(error);
    return { ok: false, error: "failed" };
  }
}
