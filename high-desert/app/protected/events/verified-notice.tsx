import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Dictionary } from "@/lib/i18n";

/**
 * Shown on any event page when the member isn't verified yet. Events are
 * verified-only at the database level (ev_read / ev_insert require
 * is_verified()), so this is the plain-language explanation of that gate rather
 * than a dead end — it points the member straight at verification.
 */
export function VerifiedNotice({
  dict,
  locale,
}: {
  dict: Dictionary;
  locale: string;
}) {
  return (
    <div
      lang={locale}
      className="flex flex-col items-start gap-4 rounded-lg border border-dashed p-6"
    >
      <ShieldCheck className="size-6 text-muted-foreground" aria-hidden="true" />
      <div className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold">{dict.events.gateTitle}</h1>
        <p className="text-sm text-muted-foreground">{dict.events.gateBody}</p>
      </div>
      <Button asChild>
        <Link href="/protected/verify">{dict.events.gateCta}</Link>
      </Button>
    </div>
  );
}
