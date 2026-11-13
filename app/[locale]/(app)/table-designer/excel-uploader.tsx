"use client";

import { FileUploader, xhrUpload } from "@/components/file-uploader";
import { MAX_UPLOAD_BYTES } from "@/lib/uploads";

const upload = xhrUpload("/api/uploads");

export function ExcelUploader() {
  return <FileUploader accept=".xlsx" upload={upload} maxSize={MAX_UPLOAD_BYTES} maxFiles={10} />;
}
