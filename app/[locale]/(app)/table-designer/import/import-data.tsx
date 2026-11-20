"use client";

import { useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  ImportIcon,
  KeyRoundIcon,
} from "lucide-react";
import { FileUploader, xhrUpload } from "@/components/file-uploader";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Spinner } from "@/components/ui/spinner";
import {
  Stepper,
  StepperActions,
  StepperContent,
  StepperDescription,
  StepperIndicator,
  StepperItem,
  StepperList,
  StepperText,
  StepperTitle,
  StepperTrigger,
} from "@/components/ui/stepper";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MAX_UPLOAD_BYTES } from "@/lib/uploads";
import type { ImportMode } from "@/lib/user-tables";
import { KeyProblems } from "../key-problems";
import { SheetPreview } from "../sheet-preview";
import {
  checkUploadImport,
  importUpload,
  type CheckImportResult,
  type ImportReport,
  type ImportResult,
} from "./actions";

const upload = xhrUpload("/api/uploads");

interface Upload {
  id: string;
  fileName: string;
}

type Step = 1 | 2 | 3;

/**
 * Imports an .xlsx into an existing table, in three steps:
 * 1. pick the table and upload the file (checked against the table);
 * 2. review the columns, problems and first rows;
 * 3. upload the data: only if the file's columns are exactly the table's
 *    and every value fits (the server checks again).
 */
export function ImportData({
  tables,
  initialTable,
}: {
  tables: string[];
  initialTable: string;
}) {
  const t = useTranslations("importData");
  const [step, setStep] = useState<Step>(1);
  const [table, setTable] = useState(initialTable);
  const [file, setFile] = useState<Upload | null>(null);
  const [check, setCheck] = useState<CheckImportResult | null>(null);
  const [checking, startCheck] = useTransition();
  const [mode, setMode] = useState<ImportMode>("upsert");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [importing, startImport] = useTransition();
  // Remounts the uploader to clear it for the next file.
  const [uploaderKey, setUploaderKey] = useState(0);

  const latest = useRef(0);
  // For upload callbacks, which may finish after the table changed.
  const tableRef = useRef(initialTable);

  /** Picks a table and/or file, then checks the file against the table. */
  const select = (nextTable: string, nextFile: Upload | null) => {
    tableRef.current = nextTable;
    setTable(nextTable);
    setFile(nextFile);
    setCheck(null);
    setResult(null);
    const request = ++latest.current;
    if (!nextTable || !nextFile) return;
    startCheck(async () => {
      let next: CheckImportResult;
      try {
        next = await checkUploadImport(nextFile.id, nextTable);
      } catch {
        next = { ok: false, error: "failed" };
      }
      // Ignore the answer if the table or file changed meanwhile.
      if (request !== latest.current) return;
      setCheck(next);
      if (next.ok) setStep(2);
    });
  };

  const report = check?.ok ? check.report : null;
  const ready = !!report && !report.blocked;
  const done = result?.ok === true;
  /** Why a mode can't be used with this file and table, if it can't. */
  const unavailable = (value: ImportMode): string | null => {
    if (!report) return null;
    // Appending rows whose key the table already has would fail.
    if (value === "append" && report.existingKeys > 0) {
      return t("mode.appendBlocked", { count: report.existingKeys });
    }
    // Upserting needs a key to tell new rows from existing ones.
    if (value === "upsert" && report.key.length === 0) return t("mode.upsertNoKey");
    return null;
  };
  const effectiveMode: ImportMode = unavailable(mode) ? "replace" : mode;

  const runImport = () => {
    if (!file || !table || !ready) return;
    startImport(async () => {
      try {
        setResult(await importUpload(file.id, file.fileName, table, effectiveMode));
      } catch {
        setResult({ ok: false, error: "failed" });
      }
    });
  };

  /** Back to step 1 for another file, same table. */
  const startOver = () => {
    select(table, null);
    setUploaderKey((key) => key + 1);
    setStep(1);
  };

  const steps = [
    { value: 1, completed: !!report, disabled: false },
    { value: 2, completed: ready, disabled: !report },
    { value: 3, completed: done, disabled: !ready },
  ] as const;

  return (
    <Stepper value={step} onValueChange={(next: Step) => !importing && setStep(next)}>
      <StepperList>
        {steps.map(({ value, completed, disabled }) => (
          <StepperItem key={value} value={value} completed={completed} disabled={disabled}>
            <StepperTrigger>
              <StepperIndicator />
              <StepperText>
                <StepperTitle>{t(`steps.${value}.title`)}</StepperTitle>
                <StepperDescription>{t(`steps.${value}.description`)}</StepperDescription>
              </StepperText>
            </StepperTrigger>
          </StepperItem>
        ))}
      </StepperList>

      {/* Steps stay mounted (hidden) so going back keeps the uploader. */}
      <StepperContent value={1} keepMounted>
        <Field className="max-w-sm">
          <FieldLabel htmlFor="import-table">{t("table")}</FieldLabel>
          <NativeSelect
            id="import-table"
            value={table}
            onChange={(event) => select(event.target.value, file)}
          >
            <NativeSelectOption value="" disabled>
              {t("chooseTable")}
            </NativeSelectOption>
            {tables.map((name) => (
              <NativeSelectOption key={name} value={name}>
                {name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>

        <FileUploader
          key={uploaderKey}
          accept=".xlsx"
          multiple={false}
          upload={upload}
          maxSize={MAX_UPLOAD_BYTES}
          onUploaded={(uploaded, response) =>
            select(tableRef.current, {
              id: (response as { id: string }).id,
              fileName: uploaded.name,
            })
          }
        />

        {file && !table && (
          <p className="text-sm text-muted-foreground">{t("pickTableFirst")}</p>
        )}
        {checking && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner /> {t("checking")}
          </p>
        )}
        {check && !check.ok && (
          <Alert variant="destructive">
            <AlertTitle>{t("errorTitle")}</AlertTitle>
            <AlertDescription>{t(`errors.${check.error}`)}</AlertDescription>
          </Alert>
        )}

        <StepperActions>
          <Button onClick={() => setStep(2)} disabled={!report || checking}>
            {t("steps.next")}
            <ArrowRightIcon />
          </Button>
        </StepperActions>
      </StepperContent>

      {report && file && (
        <StepperContent value={2} keepMounted>
          <ReportSummary report={report} table={table} />
          <ColumnsTable report={report} />
          <ValueProblems report={report} />
          <SheetPreview
            preview={{
              fileName: file.fileName,
              sheet: report.sheet,
              header: report.header,
              rows: report.previewRows,
              totalRows: report.rows,
            }}
          />
          <StepperActions>
            <Button variant="outline" onClick={() => setStep(1)}>
              <ArrowLeftIcon />
              {ready ? t("steps.back") : t("steps.uploadAgain")}
            </Button>
            <Button onClick={() => setStep(3)} disabled={!ready}>
              {t("steps.next")}
              <ArrowRightIcon />
            </Button>
          </StepperActions>
        </StepperContent>
      )}

      {report && file && ready && (
        <StepperContent value={3} keepMounted className="max-w-2xl">
          <p className="text-sm">
            {t("upload.summary", {
              rows: report.rows,
              file: file.fileName,
              table,
            })}
          </p>
          <FieldSet disabled={importing || done}>
            <FieldLegend variant="label">{t("mode.label")}</FieldLegend>
            <RadioGroup
              value={effectiveMode}
              onValueChange={(value) => setMode(value as ImportMode)}
            >
              {(["upsert", "replace", "append"] as const).map((value) => {
                const reason = unavailable(value);
                return (
                  <Field key={value} orientation="horizontal" data-disabled={!!reason || undefined}>
                    <RadioGroupItem value={value} id={`mode-${value}`} disabled={!!reason} />
                    <FieldContent>
                      <FieldLabel htmlFor={`mode-${value}`}>{t(`mode.${value}`)}</FieldLabel>
                      <FieldDescription>
                        {reason ??
                          t(`mode.${value}Description`, {
                            rows: report.rows,
                            added: report.rows - report.existingKeys,
                            updated: report.existingKeys,
                          })}
                      </FieldDescription>
                    </FieldContent>
                  </Field>
                );
              })}
            </RadioGroup>
          </FieldSet>

          {result?.ok && (
            <Alert>
              <CircleCheckIcon />
              <AlertTitle>{t("done.title", { table })}</AlertTitle>
              <AlertDescription>
                {t(`done.${result.mode}`, {
                  rows: result.rows,
                  added: result.rows - result.updated,
                  updated: result.updated,
                })}
              </AlertDescription>
            </Alert>
          )}
          {result && !result.ok && (
            <Alert variant="destructive">
              <AlertTitle>{t("errorTitle")}</AlertTitle>
              <AlertDescription>{t(`errors.${result.error}`)}</AlertDescription>
            </Alert>
          )}

          <StepperActions>
            {done ? (
              <Button onClick={startOver}>{t("steps.another")}</Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setStep(2)} disabled={importing}>
                  <ArrowLeftIcon />
                  {t("steps.back")}
                </Button>
                <Button onClick={runImport} disabled={importing}>
                  {importing ? <Spinner /> : <ImportIcon />}
                  {t("import", { table })}
                </Button>
              </>
            )}
          </StepperActions>
        </StepperContent>
      )}
    </Stepper>
  );
}

/** Whether the file can be uploaded, and if not the main reason. */
function ReportSummary({ report, table }: { report: ImportReport; table: string }) {
  const t = useTranslations("importData.report");
  const missing = report.columns.filter((c) => c.fileHeader === null).length;

  if (!report.blocked) {
    return (
      <Alert>
        <CircleCheckIcon />
        <AlertTitle>{t("ready.title")}</AlertTitle>
        <AlertDescription>
          {t("ready.description", { columns: report.columns.length, rows: report.rows, table })}
        </AlertDescription>
      </Alert>
    );
  }
  return (
    <Alert variant="destructive">
      <CircleAlertIcon />
      <AlertTitle>{t("blocked.title")}</AlertTitle>
      <AlertDescription>
        {report.blocked === "columns"
          ? t("blocked.columns", {
              details: [
                missing > 0 && t("blocked.missing", { count: missing }),
                report.extra.length > 0 && t("blocked.extra", { count: report.extra.length }),
              ]
                .filter(Boolean)
                .join(", "),
            })
          : report.blocked === "types"
            ? t("blocked.types", { count: report.problemCount })
            : t("blocked.keys", { count: report.keyProblemCount })}{" "}
        {t("blocked.fix")}
      </AlertDescription>
    </Alert>
  );
}

/** Each table column next to the file column it comes from; then extras. */
function ColumnsTable({ report }: { report: ImportReport }) {
  const t = useTranslations("importData.report");
  return (
    <div className="flex flex-col gap-2">
      <h2 className="font-medium">{t("columnsTitle")}</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("columns.table")}</TableHead>
            <TableHead>{t("columns.type")}</TableHead>
            <TableHead>{t("columns.file")}</TableHead>
            <TableHead>{t("columns.status")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {report.columns.map((column) => (
            <TableRow key={column.column}>
              <TableCell className="font-mono">
                <span className="inline-flex items-center gap-1">
                  {column.key && (
                    <KeyRoundIcon className="size-3.5" aria-label={t("primaryKey")} />
                  )}
                  {column.column}
                </span>
              </TableCell>
              <TableCell className="text-muted-foreground">{t(`types.${column.type}`)}</TableCell>
              <TableCell>{column.fileHeader ?? "—"}</TableCell>
              <TableCell>
                {column.fileHeader === null ? (
                  <Badge variant="destructive">{t("status.missing")}</Badge>
                ) : (
                  <Badge variant="outline">
                    <CheckIcon />
                    {t("status.matched")}
                  </Badge>
                )}
              </TableCell>
            </TableRow>
          ))}
          {report.extra.map((header, i) => (
            <TableRow key={`extra-${i}`}>
              <TableCell className="text-muted-foreground">—</TableCell>
              <TableCell />
              <TableCell>{header || t("untitled", { n: i + 1 })}</TableCell>
              <TableCell>
                <Badge variant="destructive">{t("status.extra")}</Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/** Values that don't fit their column, and primary key problems. */
function ValueProblems({ report }: { report: ImportReport }) {
  const t = useTranslations("importData.report");
  return (
    <>
      {report.blocked === "types" && (
        <Alert variant="destructive">
          <AlertTitle>{t("typeProblems.title", { count: report.problemCount })}</AlertTitle>
          <AlertDescription>
            <ul className="mt-1 list-disc pl-4">
              {report.problems.map((problem, i) => (
                <li key={i}>
                  {t("typeProblems.problem", {
                    row: problem.row,
                    column: problem.column,
                    value: problem.value,
                    expected: problem.expected,
                  })}
                </li>
              ))}
            </ul>
            {report.problemCount > report.problems.length && (
              <p className="mt-1">
                {t("typeProblems.more", {
                  count: report.problemCount - report.problems.length,
                })}
              </p>
            )}
          </AlertDescription>
        </Alert>
      )}
      {report.blocked === "keys" && (
        <Alert variant="destructive">
          <AlertTitle>{t("keys.title", { count: report.keyProblemCount })}</AlertTitle>
          <AlertDescription>
            {t("keys.description", { columns: report.key.join(" + ") })}
            <KeyProblems problems={report.keyProblems} count={report.keyProblemCount} />
          </AlertDescription>
        </Alert>
      )}
    </>
  );
}
