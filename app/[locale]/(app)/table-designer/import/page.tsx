import { Suspense } from "react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { TableIcon } from "lucide-react";
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
import { requireAdmin } from "@/lib/session";
import { listImportedTables } from "@/lib/user-tables";
import { ImportData } from "./import-data";

export default async function ImportPage({
  searchParams,
}: PageProps<"/[locale]/table-designer/import">) {
  const t = await getTranslations("importData");

  return (
    <PageContent>
      <PageContentHeader>
        <PageContentTitle>{t("title")}</PageContentTitle>
        <PageContentDescription>{t("description")}</PageContentDescription>
      </PageContentHeader>
      <PageContentBody>
        {/* Reads the session, the database and the URL per request. */}
        <Suspense fallback={<Skeleton className="h-48 w-full" />}>
          <AdminImport searchParams={searchParams} />
        </Suspense>
      </PageContentBody>
    </PageContent>
  );
}

async function AdminImport({
  searchParams,
}: Pick<PageProps<"/[locale]/table-designer/import">, "searchParams">) {
  // The sidebar hides the page from others; this enforces it.
  await requireAdmin();
  const t = await getTranslations("importData");
  const tables = listImportedTables().map((table) => table.tableName);

  if (tables.length === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <TableIcon />
          </EmptyMedia>
          <EmptyTitle>{t("noTables.title")}</EmptyTitle>
          <EmptyDescription>{t("noTables.description")}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/table-designer/design" />}>
            {t("noTables.action")}
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  // ?table=… preselects a table (the Tables page links here like that).
  const { table } = await searchParams;
  const initial = typeof table === "string" && tables.includes(table) ? table : "";
  return <ImportData tables={tables} initialTable={initial} />;
}
