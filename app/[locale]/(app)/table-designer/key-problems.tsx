"use client";

import { useTranslations } from "next-intl";
import type { KeyProblem } from "@/lib/user-tables";

/** The rows whose primary key is empty or repeated, as a list. */
export function KeyProblems({
  problems,
  count,
}: {
  problems: KeyProblem[];
  count: number;
}) {
  const t = useTranslations("tableDesigner.keyProblems");
  return (
    <>
      <ul className="mt-1 list-disc pl-4">
        {problems.map((problem, i) => (
          <li key={i}>
            {problem.kind === "empty"
              ? t("empty", { row: problem.row })
              : t("duplicate", {
                  row: problem.row,
                  value: problem.value,
                  firstRow: problem.firstRow ?? 0,
                })}
          </li>
        ))}
      </ul>
      {count > problems.length && (
        <p className="mt-1">{t("more", { count: count - problems.length })}</p>
      )}
    </>
  );
}
