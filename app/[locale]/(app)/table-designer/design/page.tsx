import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import {
  PageContent,
  PageContentBody,
  PageContentHeader,
  PageContentTitle,
} from "@/components/ui/page-content";
import { Skeleton } from "@/components/ui/skeleton";
import { requireAdmin } from "@/lib/session";
import { TableDesigner } from "./table-designer";

export default async function TableDesignerPage() {
  const t = await getTranslations();

  return (
    <PageContent>
      <PageContentHeader>
        <PageContentTitle>{t("tableDesigner.design")}</PageContentTitle>
      </PageContentHeader>
      <PageContentBody>
        {/* Reads the session per request. */}
        <Suspense fallback={<Skeleton className="h-48 w-full" />}>
          <AdminUploader />
        </Suspense>
      </PageContentBody>
    </PageContent>
  );
}

async function AdminUploader() {
  // The sidebar hides the page from others; this enforces it.
  await requireAdmin();
  // return <ExcelUploader />;
  return <TableDesigner />
}
