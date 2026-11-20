"use server";

import type { Row } from "read-excel-file/universal";
import { readUploadedSheet } from "@/lib/excel.server";
import { getCurrentUser, isAdmin } from "@/lib/session";
import {
  checkTableImport,
  getTableColumns,
  ImportBlockedError,
  importIntoTable,
  type ColumnType,
  type ImportCheck,
  type ImportMode,
  type KeyProblem,
  type TypeProblem,
} from "@/lib/user-tables";

/** How many rows the check sends back for the preview. */
const PREVIEW_ROWS = 10;

type Failure = "forbidden" | "notFound" | "noTable" | "invalidFile" | "failed";

/** What importing a file into a table would do, for the page to show. */
export interface ImportReport {
  sheet: string;
  header: Row;
  previewRows: Row[];
  rows: number;
  /**
   * The table's columns in order, with the file column each comes from
   * (`fileHeader`: null if the file doesn't have it).
   */
  columns: {
    column: string;
    type: ColumnType;
    key: boolean;
    fileHeader: string | null;
  }[];
  /** File columns the table doesn't have. */
  extra: string[];
  problems: TypeProblem[];
  problemCount: number;
  /** The table's primary key columns (empty: no key). */
  key: string[];
  keyProblems: KeyProblem[];
  keyProblemCount: number;
  /** Rows whose key the table already has: Append is blocked if > 0. */
  existingKeys: number;
  blocked?: ImportCheck["blocked"];
}

export type CheckImportResult =
  | { ok: true; report: ImportReport }
  | { ok: false; error: Failure };

export type ImportResult =
  | {
      ok: true;
      rows: number;
      mode: ImportMode;
      /** Upserts: rows whose key was already there (the rest were added). */
      updated: number;
    }
  | { ok: false; error: Failure | "blocked" | "existingKeys" };

async function isAllowed() {
  // Server actions are public endpoints: check the role like the page does.
  return isAdmin(await getCurrentUser());
}

/**
 * Checks an uploaded file against a table's column mapping, without
 * writing anything. The file is read on the server.
 */
export async function checkUploadImport(
  uploadId: string,
  tableName: string,
): Promise<CheckImportResult> {
  if (!(await isAllowed())) return { ok: false, error: "forbidden" };
  const sheet = await readUploadedSheet(uploadId);
  if (!sheet.ok) return sheet;

  const check = checkTableImport(tableName, sheet.header, sheet.rows);
  if (!check) return { ok: false, error: "noTable" };
  const isKey = (column: { keyPosition: number | null }) => column.keyPosition !== null;
  // In the table's order (the check lists them matched first, then missing).
  const columns = getTableColumns(tableName) ?? [];
  return {
    ok: true,
    report: {
      sheet: sheet.sheet,
      header: sheet.header,
      previewRows: sheet.rows.slice(0, PREVIEW_ROWS),
      rows: check.rows,
      columns: columns.map((column) => {
        const found = check.matched.find((m) => m.column.name === column.name);
        return {
          column: column.name,
          type: column.type,
          key: isKey(column),
          fileHeader: found ? String(sheet.header[found.index] ?? "") : null,
        };
      }),
      extra: check.extra.map((column) => column.header),
      problems: check.problems,
      problemCount: check.problemCount,
      key: columns
        .filter(isKey)
        .sort((a, b) => a.keyPosition! - b.keyPosition!)
        .map((column) => column.name),
      keyProblems: check.keys.problems,
      keyProblemCount: check.keys.count,
      existingKeys: check.existingKeys,
      blocked: check.blocked,
    },
  };
}

/** Imports an uploaded file into a table, through its column mapping. */
export async function importUpload(
  uploadId: string,
  fileName: string,
  tableName: string,
  mode: ImportMode,
): Promise<ImportResult> {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user)) return { ok: false, error: "forbidden" };
  if (!["append", "replace", "upsert"].includes(mode)) return { ok: false, error: "failed" };
  const sheet = await readUploadedSheet(uploadId);
  if (!sheet.ok) return sheet;

  try {
    const check = importIntoTable(
      { uploadId, fileName, sheet: sheet.sheet, userId: user.id },
      tableName,
      mode,
      sheet.header,
      sheet.rows,
    );
    if (!check) return { ok: false, error: "noTable" };
    return {
      ok: true,
      rows: check.rows,
      mode,
      updated: mode === "upsert" ? check.existingKeys : 0,
    };
  } catch (error) {
    if (error instanceof ImportBlockedError) {
      return {
        ok: false,
        error: error.check.blocked === "existingKeys" ? "existingKeys" : "blocked",
      };
    }
    console.error(error);
    return { ok: false, error: "failed" };
  }
}
