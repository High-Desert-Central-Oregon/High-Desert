import { Suspense } from "react";
import Link from "next/link";
import { getLocale } from "@/lib/i18n/server";
import { pc } from "@/lib/member-pipelines/copy";
import { contactCopy } from "@/lib/messages/contact-copy";
async function Help() {
  const locale = await getLocale();
  return (
    <div lang={locale} className="flex flex-col gap-5">
      <h1 className="font-serif text-3xl">{pc(locale, "help")}</h1>
      <p>{pc(locale, "helpIntro")}</p>
      <Link className="inline-flex min-h-11 items-center self-start bg-primary px-5 py-3 font-semibold text-primary-foreground focus-ring" href="/protected/messages/contact">
        {contactCopy[locale].title}
      </Link>
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
