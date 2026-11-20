import path from "node:path";

/** Where the upload route saves files. */
export const UPLOAD_DIR = path.join(process.cwd(), "data", "uploads");

/** An upload id as made by the upload route: a UUID plus an extension. */
const UPLOAD_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(\.[a-z0-9]+)?$/;

/** The path of an upload, or null for anything that isn't an upload id. */
export function uploadPath(id: string): string | null {
  return UPLOAD_ID.test(id) ? path.join(UPLOAD_DIR, id) : null;
}
