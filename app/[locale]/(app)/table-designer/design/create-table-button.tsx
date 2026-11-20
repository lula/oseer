"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { DatabaseIcon, KeyRoundIcon } from "lucide-react";
import type { Row } from "read-excel-file/browser";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldDescription,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { createTableFromUpload, type CreateTableResult } from "./actions";
import { KeyProblems } from "../key-problems";

/**
 * Picks the primary key columns, creates a database table from an uploaded
 * sheet, then shows the outcome.
 */
export function CreateTableButton({
  uploadId,
  fileName,
  header,
}: {
  uploadId: string;
  fileName: string;
  header: Row;
}) {
  const t = useTranslations("tableDesigner.create");
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<CreateTableResult | null>(null);
  /** Header cells (0-based) in the primary key. */
  const [key, setKey] = useState<number[]>([]);

  const toggle = (index: number, checked: boolean) => {
    setKey((current) =>
      checked ? [...current, index].sort((a, b) => a - b) : current.filter((i) => i !== index),
    );
    // A different key may fix the problems: don't keep showing them.
    setResult(null);
  };

  const create = () =>
    startTransition(async () => {
      try {
        setResult(await createTableFromUpload(uploadId, fileName, key));
      } catch {
        setResult({ ok: false, error: "failed" });
      }
    });

  const label = (index: number) =>
    String(header[index] ?? "") || t("untitledColumn", { n: index + 1 });

  return (
    <div className="flex w-full flex-col gap-4">
      <FieldSet disabled={pending || result?.ok}>
        <FieldLegend variant="label">
          <KeyRoundIcon className="mr-1 inline size-4" />
          {t("key.label")}
        </FieldLegend>
        <FieldDescription>{t("key.description")}</FieldDescription>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {header.map((_, index) => (
            <Field key={index} orientation="horizontal" className="w-auto">
              <Checkbox
                id={`key-${index}`}
                checked={key.includes(index)}
                onCheckedChange={(checked) => toggle(index, checked)}
              />
              <FieldLabel htmlFor={`key-${index}`} className="font-normal">
                {label(index)}
              </FieldLabel>
            </Field>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">
          {key.length === 0
            ? t("key.none")
            : t("key.chosen", { columns: key.map(label).join(" + ") })}
        </p>
      </FieldSet>

      <Button
        className="self-start"
        onClick={create}
        disabled={pending || result?.ok}
      >
        {pending ? <Spinner /> : <DatabaseIcon />}
        {t("button")}
      </Button>
      {result?.ok && (
        <Alert>
          <AlertTitle>{t("doneTitle", { table: result.table })}</AlertTitle>
          <AlertDescription>
            {t("doneDescription", {
              columns: result.columns.length,
              rows: result.rows,
            })}
          </AlertDescription>
        </Alert>
      )}
      {result && !result.ok && result.error === "keys" && (
        <Alert variant="destructive">
          <AlertTitle>{t("keyErrorTitle", { count: result.count })}</AlertTitle>
          <AlertDescription>
            {t("keyErrorDescription")}
            <KeyProblems problems={result.problems} count={result.count} />
          </AlertDescription>
        </Alert>
      )}
      {result && !result.ok && result.error !== "keys" && (
        <Alert variant="destructive">
          <AlertTitle>{t("errorTitle")}</AlertTitle>
          <AlertDescription>{t(`errors.${result.error}`)}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
