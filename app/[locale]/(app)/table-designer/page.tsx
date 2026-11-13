import {
  PageContent,
  PageContentBody,
  PageContentHeader,
  PageContentTitle,
} from "@/components/ui/page-content";
import { getTranslations } from "next-intl/server";
import { ExcelUploader } from "./excel-uploader";

export default async function Home() {
  const t = await getTranslations();

  return (
    <PageContent>
      <PageContentHeader>
        <PageContentTitle>{t("tableDesigner.title")}</PageContentTitle>
      </PageContentHeader>
      <PageContentBody>
        <ExcelUploader />
      </PageContentBody>
    </PageContent>
  );
}
