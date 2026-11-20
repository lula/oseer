"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import readXlsxFile from "read-excel-file/browser";
import { FileUploader, xhrUpload } from "@/components/file-uploader";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { MAX_UPLOAD_BYTES } from "@/lib/uploads";
import { CreateTableButton } from "./design/create-table-button";
import { PREVIEW_ROWS, SheetPreview, type SheetPreviewData } from "./sheet-preview";

const upload = xhrUpload("/api/uploads");

/** Uploads .xlsx files and previews the first sheet of the latest one. */
export function ExcelUploader() {
  const t = useTranslations("tableDesigner.preview");
  const [preview, setPreview] = useState<
    (SheetPreviewData & { uploadId: string }) | null
  >(null);
  const [error, setError] = useState<string | null>(null);

  const showPreview = async (file: File, uploadId: string) => {
    try {
      const [first] = await readXlsxFile(file);
      // Trailing empty rows are already dropped; the header is the first row.
      const [header = [], ...rows] = first.data;
      setPreview({
        uploadId,
        fileName: file.name,
        sheet: first.sheet,
        header,
        rows: rows.slice(0, PREVIEW_ROWS),
        totalRows: rows.length,
      });
      setError(null);
    } catch (cause) {
      console.error(cause);
      setPreview(null);
      setError(file.name);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <FileUploader
        accept=".xlsx"
        upload={upload}
        maxSize={MAX_UPLOAD_BYTES}
        maxFiles={10}
        onUploaded={(file, result) =>
          void showPreview(file, (result as { id: string }).id)
        }
      />
      {error && (
        <Alert variant="destructive">
          <AlertTitle>{t("errorTitle")}</AlertTitle>
          <AlertDescription>{t("errorDescription", { name: error })}</AlertDescription>
        </Alert>
      )}
      {preview && (
        <SheetPreview
          preview={preview}
          footer={
            <CreateTableButton
              // A new upload starts over (no leftover result or error).
              key={preview.uploadId}
              uploadId={preview.uploadId}
              fileName={preview.fileName}
              header={preview.header}
            />
          }
        />
      )}
    </div>
  );
}
