import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { getCurrentUser } from "@/lib/session";
import { MAX_UPLOAD_BYTES } from "@/lib/uploads";
import { UPLOAD_DIR } from "@/lib/uploads.server";

/** Saves one file (multipart field `file`) to data/uploads/. */
export async function POST(request: Request) {
  // The proxy skips this route (see proxy.ts), so check the session here.
  if (!(await getCurrentUser())) {
    return Response.json({ error: "Not signed in" }, { status: 401 });
  }

  const length = Number(request.headers.get("content-length"));
  if (length > MAX_UPLOAD_BYTES + 64 * 1024) {
    return Response.json({ error: "File too large" }, { status: 413 });
  }

  const file = (await request.formData()).get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "No file" }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return Response.json({ error: "File too large" }, { status: 413 });
  }

  // Never trust the client's file name for the path: keep only a safe extension.
  const ext = path.extname(file.name).toLowerCase().replace(/[^.a-z0-9]/g, "");
  const id = `${randomUUID()}${ext}`;
  await mkdir(UPLOAD_DIR, { recursive: true });
  await writeFile(path.join(UPLOAD_DIR, id), Buffer.from(await file.arrayBuffer()));

  return Response.json({ id, name: file.name, size: file.size }, { status: 201 });
}
