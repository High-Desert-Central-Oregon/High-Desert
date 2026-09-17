import { Suspense } from "react";
import Link from "next/link";
import { getLocale } from "@/lib/i18n/server";
import { pc } from "@/lib/member-pipelines/copy";
async function Help() {
  const locale = await getLocale();
  return (
    <div lang={locale} className="flex flex-col gap-5">
      <h1 className="font-serif text-3xl">{pc(locale, "help")}</h1>
      <p>{pc(locale, "helpIntro")}</p>
      <a className="min-h-11 underline" href="mailto:hello@steppe.community">
        {pc(locale, "accountHelp")}
      </a>
      <Link className="min-h-11 underline" href="/protected/verify">
        {pc(locale, "viewStatus")}
      </Link>
      <Link className="min-h-11 underline" href="/protected/activity">
        {pc(locale, "myReports")}
      </Link>
      <p>{pc(locale, "safetyHelp")}</p>
    </div>
  );
}
export default function HelpPage() {
  return (
    <Suspense>
      <Help />
    </Suspense>
  );
}
