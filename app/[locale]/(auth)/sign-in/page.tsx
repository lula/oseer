import { getTranslations } from "next-intl/server";
import { useTranslations } from "next-intl";
import type { Metadata } from "next";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SignInForm } from "./sign-in-form";
import { SparklesIcon } from "lucide-react";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.signIn");
  return { title: t("meta") };
}

export default function SignInPage() {
  const t = useTranslations("auth.signIn");
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 items-center justify-center">
          <SparklesIcon />
          <span className="shimmer font-medium text-2xl">
            Open Seer
          </span>
        </div>
        <CardTitle className="text-xl text-center">{t("title")}</CardTitle>
        <CardDescription className="text-center">
          {t("description")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <SignInForm />
      </CardContent>
    </Card>
  );
}
