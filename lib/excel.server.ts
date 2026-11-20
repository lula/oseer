import { readFile } from "node:fs/promises";
import path from "node:path";
// Not "/node": its streaming unzipper rejects valid files whose zip entries
// store sizes after the data ("invalid signature"), as Excel sometimes
// writes them. "/universal" reads the whole file (fine up to the 50 MB limit).
import readXlsxFile, { type Row } from "read-excel-file/universal";
import { uploadPath } from "./uploads.server";

export type UploadedSheet =
  | { ok: true; sheet: string; header: Row; rows: Row[] }
  | { ok: false; error: "notFound" | "invalidFile" };

/**
 * The first sheet of an uploaded .xlsx: its header row and the other rows.
 * Read on the server from data/uploads/, never from what a browser sends.
 */
export async function readUploadedSheet(uploadId: string): Promise<UploadedSheet> {
  const file = uploadPath(uploadId);
  if (!file || path.extname(file) !== ".xlsx") {
    return { ok: false, error: "notFound" };
  }
  try {
    const bytes = await readFile(file);
    const [sheet] = await readXlsxFile(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    );
    const [header = [], ...rows] = sheet.data;
    return { ok: true, sheet: sheet.sheet, header, rows };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { ok: false, error: "notFound" };
    }
    console.error(error);
    return { ok: false, error: "invalidFile" };
  }
}
