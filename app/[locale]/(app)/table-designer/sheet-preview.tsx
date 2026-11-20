"use client";

import type { ReactNode } from "react";
import { useFormatter, useTranslations } from "next-intl";
import type { CellValue, Row } from "read-excel-file/browser";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/** How many data rows (after the header) the preview shows. */
export const PREVIEW_ROWS = 10;

export interface SheetPreviewData {
  fileName: string;
  sheet: string;
  header: Row;
  /** The first PREVIEW_ROWS data rows. */
  rows: Row[];
  /** Data rows in the whole sheet (header excluded). */
  totalRows: number;
}

/** The header and first rows of a sheet, as a table. */
export function SheetPreview({
  preview,
  footer,
}: {
  preview: SheetPreviewData;
  /** Below the table, e.g. actions on the sheet. */
  footer?: ReactNode;
}) {
  const t = useTranslations("tableDesigner.preview");
  const format = useFormatter();
  const columns = preview.header.length;

  const show = (value: CellValue | null) => {
    if (value === null || value === undefined) return "";
    if (value instanceof Date) {
      // Excel dates have no time zone: show them as written.
      return format.dateTime(value, { dateStyle: "medium", timeZone: "UTC" });
    }
    if (typeof value === "number") return format.number(value);
    return String(value);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{preview.fileName}</CardTitle>
        <CardDescription>
          {t("summary", {
            sheet: preview.sheet,
            columns,
            rows: preview.totalRows,
            shown: preview.rows.length,
          })}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              {preview.header.map((cell, i) => (
                <TableHead key={i}>
                  {show(cell) || t("untitledColumn", { n: i + 1 })}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {preview.rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns} className="text-center text-muted-foreground">
                  {t("noRows")}
                </TableCell>
              </TableRow>
            ) : (
              preview.rows.map((row, r) => (
                <TableRow key={r}>
                  {Array.from({ length: columns }, (_, c) => (
                    <TableCell
                      key={c}
                      className={typeof row[c] === "number" ? "text-right tabular-nums" : undefined}
                    >
                      {show(row[c] ?? null)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
      {footer && <CardFooter>{footer}</CardFooter>}
    </Card>
  );
}
