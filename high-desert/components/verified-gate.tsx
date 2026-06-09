import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * A plain-language gate shown when an unverified member reaches a verified-only
 * surface (events, governance). Participation is gated in the database (RLS keyed
 * on is_verified()); this explains that gate and points at verification rather
 * than dead-ending. Text is passed in so each area can speak for itself.
 */
export function VerifiedGate({
  title,
  body,
  ctaLabel,
  locale,
}: {
  title: string;
  body: string;
  ctaLabel: string;
  locale: string;
}) {
  return (
    <div
      lang={locale}
      className="flex flex-col items-start gap-4 rounded-lg border border-dashed p-6"
    >
      <ShieldCheck className="size-6 text-muted-foreground" aria-hidden="true" />
      <div className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold">{title}</h1>
        <p className="text-sm text-muted-foreground">{body}</p>
      </div>
      <Button asChild>
        <Link href="/protected/verify">{ctaLabel}</Link>
      </Button>
    </div>
  );
}
