"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CircleCheckIcon,
  DatabaseIcon,
  KeyRoundIcon,
} from "lucide-react";
import { FileUploader, xhrUpload } from "@/components/file-uploader";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
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
import { KeyProblems } from "../key-problems";
import { SheetPreview } from "../sheet-preview";
import {
  checkKeyForUpload,
  createTableFromUpload,
  planTableFromUpload,
  type CreateTableResult,
  type KeyCheckResult,
  type PlanResult,
  type UploadPlan,
} from "./actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Combobox, ComboboxContent, ComboboxInput, ComboboxItem } from "@/components/ui/combobox";

const upload = xhrUpload("/api/uploads");

interface Upload {
  id: string;
  fileName: string;
}

type Step = 1 | 2 | 3 | 4;

/**
 * Creates a table from an .xlsx, in four steps:
 * 1. upload the file;
 * 2. preview the table it would become (name, columns, types, first rows);
 * 3. choose the primary key, checked against every row;
 * 4. create the table.
 */
export function TableDesigner() {
  const t = useTranslations("tableDesigner");
  const [step, setStep] = useState<Step>(1);
  /** The furthest step the user may go to. */
  const [reached, setReached] = useState<Step>(1);
  const [file, setFile] = useState<Upload | null>(null);
  const [plan, setPlan] = useState<PlanResult | null>(null);
  const [planning, startPlan] = useTransition();
  /** Header cells (0-based) in the primary key. */
  const [key, setKey] = useState<number[]>([]);
  const [keyCheck, setKeyCheck] = useState<KeyCheckResult | null>(null);
  const [checkingKey, startKeyCheck] = useTransition();
  const [created, setCreated] = useState<CreateTableResult | null>(null);
  const [creating, startCreate] = useTransition();
  // Remounts the uploader to clear it for the next file.
  const [uploaderKey, setUploaderKey] = useState(0);

  const go = (next: Step) => {
    setStep(next);
    setReached((current) => (next > current ? next : current));
  };

  const onUploaded = (next: Upload) => {
    setFile(next);
    setPlan(null);
    setKey([]);
    setKeyCheck(null);
    setCreated(null);
    setReached(1);
    startPlan(async () => {
      let result: PlanResult;
      try {
        result = await planTableFromUpload(next.id, next.fileName);
      } catch {
        result = { ok: false, error: "failed" };
      }
      setPlan(result);
      if (result.ok) go(2);
    });
  };

  const toggleKey = (index: number, checked: boolean) => {
    setKey((current) =>
      checked ? [...current, index].sort((a, b) => a - b) : current.filter((i) => i !== index),
    );
    // A different key needs checking again before step 4.
    setKeyCheck(null);
    setReached((current) => (current > 3 ? 3 : current));
  };

  /** Checks the key against every row; moves on if it fits. */
  const confirmKey = () => {
    if (!file) return;
    if (key.length === 0) return go(4);
    startKeyCheck(async () => {
      let result: KeyCheckResult;
      try {
        result = await checkKeyForUpload(file.id, key);
      } catch {
        result = { ok: false, error: "failed" };
      }
      setKeyCheck(result);
      if (result.ok && result.count === 0) go(4);
    });
  };

  const create = () => {
    if (!file) return;
    startCreate(async () => {
      try {
        setCreated(await createTableFromUpload(file.id, file.fileName, key));
      } catch {
        setCreated({ ok: false, error: "failed" });
      }
    });
  };

  const startOver = () => {
    setFile(null);
    setPlan(null);
    setKey([]);
    setKeyCheck(null);
    setCreated(null);
    setUploaderKey((n) => n + 1);
    setReached(1);
    setStep(1);
  };

  const current = plan?.ok ? plan.plan : null;
  const done = created?.ok === true;
  const busy = planning || checkingKey || creating;
  const label = (index: number) =>
    String(current?.header[index] ?? "") || t("create.untitledColumn", { n: index + 1 });
  const keyNames = key.map((i) => current?.columns[i]?.name ?? label(i));

  return (
    <Stepper value={step} onValueChange={(next: Step) => !busy && setStep(next)}>
      <StepperList>
        {([1, 2, 3, 4] as const).map((value) => (
          <StepperItem
            key={value}
            value={value}
            completed={value < reached || (value === 4 && done)}
            disabled={value > reached}
          >
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

      {/* 1. Upload. Kept mounted so going back keeps the uploader. */}
      <StepperContent value={1} keepMounted>
        <FileUploader
          key={uploaderKey}
          accept=".xlsx"
          multiple={false}
          upload={upload}
          maxSize={MAX_UPLOAD_BYTES}
          onUploaded={(uploaded, response) =>
            onUploaded({ id: (response as { id: string }).id, fileName: uploaded.name })
          }
        />
        {planning && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner /> {t("reading")}
          </p>
        )}
        {plan && !plan.ok && (
          <Alert variant="destructive">
            <AlertTitle>{t("create.errorTitle")}</AlertTitle>
            <AlertDescription>{t(`create.errors.${plan.error}`)}</AlertDescription>
          </Alert>
        )}
        <StepperActions>
          <Button onClick={() => go(2)} disabled={!current || planning}>
            {t("steps.next")}
            <ArrowRightIcon />
          </Button>
        </StepperActions>
      </StepperContent>

      {current && file && (
        <>
          {/* 2. Preview. */}
          <StepperContent value={2}>
            <p className="text-sm">
              {t.rich("plan.summary", {
                table: current.table,
                columns: current.columns.length,
                rows: current.rows,
                name: (chunks) => <code className="font-mono">{chunks}</code>,
              })}
            </p>
            <SheetPreview
              preview={{
                fileName: file.fileName,
                sheet: current.sheet,
                header: current.header,
                rows: current.previewRows,
                totalRows: current.rows,
              }}
            />
            <StepperActions>
              <Button variant="outline" onClick={() => setStep(1)}>
                <ArrowLeftIcon />
                {t("steps.back")}
              </Button>
              <Button onClick={() => go(3)}>
                {t("steps.next")}
                <ArrowRightIcon />
              </Button>
            </StepperActions>
          </StepperContent>

          {/* 3. Primary key. */}
          <StepperContent value={3} className="max-w-3xl">
            <PlanColumns plan={current} />
            <FieldSet disabled={checkingKey || done}>
              <FieldLegend variant="label">
                <KeyRoundIcon className="mr-1 inline size-4" />
                {t("create.key.label")}
              </FieldLegend>
              <FieldDescription>{t("create.key.description")}</FieldDescription>
              <div className="flex flex-wrap gap-x-5 gap-y-2">
                {current.header.map((_, index) => (
                  <Field key={index} orientation="horizontal" className="w-auto">
                    <Checkbox
                      id={`key-${index}`}
                      checked={key.includes(index)}
                      onCheckedChange={(checked) => toggleKey(index, checked)}
                    />
                    <FieldLabel htmlFor={`key-${index}`} className="font-normal">
                      {label(index)}
                    </FieldLabel>
                  </Field>
                ))}

                <Combobox multiple>
                  <ComboboxInput />
                  <ComboboxContent>
                    {current.header.map((_, index) => (
                      <ComboboxItem key={`col-${index}`} value={index}>
                        {label(index)}
                      </ComboboxItem>
                    ))}
                  </ComboboxContent>
                </Combobox>
              </div>
              <p className="text-sm text-muted-foreground">
                {key.length === 0
                  ? t("create.key.none")
                  : t("create.key.chosen", { columns: key.map(label).join(" + ") })}
              </p>
            </FieldSet>
            {keyCheck?.ok && keyCheck.count > 0 && (
              <Alert variant="destructive">
                <AlertTitle>{t("create.keyErrorTitle", { count: keyCheck.count })}</AlertTitle>
                <AlertDescription>
                  {t("create.keyErrorDescription")}
                  <KeyProblems problems={keyCheck.problems} count={keyCheck.count} />
                </AlertDescription>
              </Alert>
            )}
            {keyCheck && !keyCheck.ok && (
              <Alert variant="destructive">
                <AlertTitle>{t("create.errorTitle")}</AlertTitle>
                <AlertDescription>{t(`create.errors.${keyCheck.error}`)}</AlertDescription>
              </Alert>
            )}
            <StepperActions>
              <Button variant="outline" onClick={() => setStep(2)} disabled={checkingKey}>
                <ArrowLeftIcon />
                {t("steps.back")}
              </Button>
              <Button onClick={confirmKey} disabled={checkingKey}>
                {checkingKey && <Spinner />}
                {t("steps.next")}
                {!checkingKey && <ArrowRightIcon />}
              </Button>
            </StepperActions>
          </StepperContent>

          {/* 4. Create. */}
          <StepperContent value={4} className="max-w-3xl">
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
              <dt className="text-muted-foreground">{t("plan.table")}</dt>
              <dd className="font-mono">{done ? created.table : current.table}</dd>
              <dt className="text-muted-foreground">{t("plan.columns")}</dt>
              <dd>{current.columns.length}</dd>
              <dt className="text-muted-foreground">{t("plan.key")}</dt>
              <dd className={key.length ? "font-mono" : undefined}>
                {key.length ? keyNames.join(" + ") : t("plan.noKey")}
              </dd>
              <dt className="text-muted-foreground">{t("plan.rows")}</dt>
              <dd>{current.rows}</dd>
              <dt className="text-muted-foreground">{t("plan.source")}</dt>
              <dd>
                {file.fileName} · {current.sheet}
              </dd>
            </dl>

            {created?.ok && (
              <Alert>
                <CircleCheckIcon />
                <AlertTitle>{t("create.doneTitle", { table: created.table })}</AlertTitle>
                <AlertDescription>
                  {t("create.doneDescription", {
                    columns: created.columns.length,
                    rows: created.rows,
                  })}
                </AlertDescription>
              </Alert>
            )}
            {created && !created.ok && created.error === "keys" && (
              <Alert variant="destructive">
                <AlertTitle>{t("create.keyErrorTitle", { count: created.count })}</AlertTitle>
                <AlertDescription>
                  {t("create.keyErrorDescription")}
                  <KeyProblems problems={created.problems} count={created.count} />
                </AlertDescription>
              </Alert>
            )}
            {created && !created.ok && created.error !== "keys" && (
              <Alert variant="destructive">
                <AlertTitle>{t("create.errorTitle")}</AlertTitle>
                <AlertDescription>{t(`create.errors.${created.error}`)}</AlertDescription>
              </Alert>
            )}

            <StepperActions>
              {created?.ok ? (
                <>
                  <Button
                    nativeButton={false}
                    render={
                      <Link
                        href={`/table-designer/import?table=${encodeURIComponent(created.table)}`}
                      />
                    }
                  >
                    {t("after.import")}
                  </Button>
                  <Button
                    variant="outline"
                    nativeButton={false}
                    render={<Link href="/table-designer/tables" />}
                  >
                    {t("after.tables")}
                  </Button>
                  <Button variant="ghost" onClick={startOver}>
                    {t("after.another")}
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" onClick={() => setStep(3)} disabled={creating}>
                    <ArrowLeftIcon />
                    {t("steps.back")}
                  </Button>
                  <Button onClick={create} disabled={creating}>
                    {creating ? <Spinner /> : <DatabaseIcon />}
                    {t("create.button")}
                  </Button>
                </>
              )}
            </StepperActions>
          </StepperContent>
        </>
      )}
    </Stepper>
  );
}

/** Each Excel header next to the column it becomes, and its type. */
function PlanColumns({ plan }: { plan: UploadPlan }) {
  const t = useTranslations("tableDesigner.plan");
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("columnsTitle")}</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("fileColumn")}</TableHead>
              <TableHead>{t("tableColumn")}</TableHead>
              <TableHead>{t("type")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {plan.columns.map((column, i) => (
              <TableRow key={column.name}>
                <TableCell>{column.header || t("untitled", { n: i + 1 })}</TableCell>
                <TableCell className="font-mono">{column.name}</TableCell>
                <TableCell className="text-muted-foreground">{t(`types.${column.type}`)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
