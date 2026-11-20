import { Skeleton } from "@/components/ui/skeleton";
import { Suspense } from "react";

export default function TablesPage({
  params,
}: PageProps<"/[locale]/tables/[tableName]">) {
  return <Suspense fallback={<Skeleton className="h-96 w-full" />}>
    <TableDetail params={params} />
  </Suspense>;
}

async function TableDetail({ params }: Pick<PageProps<"/[locale]/tables/[tableName]">, "params">) {
  const tableName = (await params).tableName
  return <div>{tableName}</div>;
}
