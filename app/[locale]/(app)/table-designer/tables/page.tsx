import { Suspense } from "react";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { ImportIcon, TableIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  PageContent,
  PageContentBody,
  PageContentDescription,
  PageContentHeader,
  PageContentTitle,
} from "@/components/ui/page-content";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireAdmin } from "@/lib/session";
import { listImportedTables } from "@/lib/user-tables";
import { findUsers } from "@/lib/users";
import { DropTableButton } from "./drop-table-button";

export default async function TablesPage() {
  const t = await getTranslations("tables");

  return (
    <PageContent>
      <PageContentHeader>
        <PageContentTitle>{t("title")}</PageContentTitle>
        <PageContentDescription>{t("description")}</PageContentDescription>
      </PageContentHeader>
      <PageContentBody>
        {/* Reads the session and the database per request. */}
        <Suspense fallback={<Skeleton className="h-40 w-full" />}>
          <TablesList />
        </Suspense>
      </PageContentBody>
    </PageContent>
  );
}

async function TablesList() {
  // The sidebar hides the page from others; this enforces it.
  await requireAdmin();
  const t = await getTranslations("tables");
  const format = await getFormatter();

  const tables = listImportedTables();
  const users = findUsers(tables.map((table) => table.createdBy));

  if (tables.length === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <TableIcon />
          </EmptyMedia>
          <EmptyTitle>{t("empty.title")}</EmptyTitle>
          <EmptyDescription>{t("empty.description")}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/table-designer/design" />}>
            {t("empty.action")}
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t("columns.table")}</TableHead>
          <TableHead>{t("columns.lastImport")}</TableHead>
          <TableHead className="text-right">{t("columns.rows")}</TableHead>
          <TableHead>{t("columns.createdBy")}</TableHead>
          <TableHead>{t("columns.createdAt")}</TableHead>
          <TableHead>
            <span className="sr-only">{t("columns.actions")}</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tables.map((table) => {
          const user = users.get(table.createdBy);
          return (
            <TableRow key={table.tableName}>
              <TableCell className="font-mono">{table.tableName}</TableCell>
              <TableCell>
                {table.fileName}
                <span className="block text-xs text-muted-foreground">
                  {format.dateTime(new Date(table.lastImportAt), {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                  {" · "}
                  {t("importCount", { count: table.importCount })}
                </span>
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {format.number(table.rowCount)}
              </TableCell>
              <TableCell>
                {user ? (
                  <>
                    {user.name}
                    <span className="block text-xs text-muted-foreground">
                      {user.email}
                    </span>
                  </>
                ) : (
                  <span className="text-muted-foreground">{t("deletedUser")}</span>
                )}
              </TableCell>
              <TableCell>
                {format.dateTime(new Date(table.createdAt), {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </TableCell>
              <TableCell className="text-right whitespace-nowrap">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  nativeButton={false}
                  aria-label={t("importInto", { table: table.tableName })}
                  title={t("importInto", { table: table.tableName })}
                  render={
                    <Link
                      href={`/table-designer/import?table=${encodeURIComponent(table.tableName)}`}
                    />
                  }
                >
                  <ImportIcon />
                </Button>
                <DropTableButton tableName={table.tableName} rowCount={table.rowCount} />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
