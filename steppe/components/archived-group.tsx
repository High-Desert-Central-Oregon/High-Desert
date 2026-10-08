import Link from "next/link";
import type { Locale } from "@/lib/i18n";
import { groupArchiveCopy } from "@/lib/group-archive-copy";

/** Directory-safe notice: never includes a private description or member roster. */
export function ArchivedGroup({
  name,
  locale,
}: {
  name: string;
  locale: Locale;
}) {
  const copy = groupArchiveCopy[locale];
  return (
    <div lang={locale} className="flex min-w-0 flex-col gap-5">
      <Link
        href="/protected/groups"
        className="focus-ring self-start underline"
      >
        {copy.back}
      </Link>
      <h1 className="break-words text-2xl font-semibold">{name}</h1>
      <section
        className="flex flex-col gap-3 border bg-card p-4"
        aria-labelledby="archived-group-title"
      >
        <h2 id="archived-group-title" className="text-lg font-semibold">
          {copy.archived}
        </h2>
        <p>{copy.archivedBody}</p>
      </section>
      <div className="flex flex-wrap gap-4">
        <Link
          href="/protected/account/calendar"
          className="focus-ring min-h-11 py-3 underline"
        >
          {copy.calendar}
        </Link>
        <Link
          href="/protected/messages"
          className="focus-ring min-h-11 py-3 underline"
        >
          {copy.messages}
        </Link>
      </div>
    </div>
  );
}
