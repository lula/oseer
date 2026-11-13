import {
  PageContent,
  PageContentBody,
  PageContentHeader,
  PageContentTitle,
} from "@/components/ui/page-content";
import { getTranslations } from "next-intl/server";

export default async function Home() {
  const t = await getTranslations();

  return (
    <PageContent>
      <PageContentHeader>
        <PageContentTitle>{t("home.title")}</PageContentTitle>
      </PageContentHeader>
      <PageContentBody>

      </PageContentBody>
    </PageContent>
  );
}
