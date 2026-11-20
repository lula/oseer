"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Trash2Icon } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { dropTable, type DropTableResult } from "./actions";

/** Drops a table after the user confirms it. */
export function DropTableButton({
  tableName,
  rowCount,
}: {
  tableName: string;
  rowCount: number;
}) {
  const t = useTranslations("tables.drop");
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<
    Extract<DropTableResult, { ok: false }>["error"] | null
  >(null);

  const drop = () =>
    startTransition(async () => {
      let result: DropTableResult;
      try {
        result = await dropTable(tableName);
      } catch {
        result = { ok: false, error: "failed" };
      }
      if (result.ok) {
        // The page refreshes without this row.
        setOpen(false);
      } else {
        setError(result.error);
      }
    });

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        setOpen(next);
        if (next) setError(null);
      }}
    >
      <AlertDialogTrigger
        render={
          <Button variant="ghost" size="icon-sm" aria-label={t("button", { table: tableName })} />
        }
      >
        <Trash2Icon />
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("title", { table: tableName })}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("description", { rows: rowCount })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {t(`errors.${error}`)}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{t("cancel")}</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={drop} disabled={pending}>
            {pending && <Spinner />}
            {t("confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
