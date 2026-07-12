import { Suspense } from "react";
import { PageSkeleton } from "@/components/page-skeleton";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FilePlus2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { VerifiedGate } from "@/components/verified-gate";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/auth";
import { getServerDictionary } from "@/lib/i18n/server";
import { GovSegments } from "./gov-segments";
import { formatRedmondDateTime } from "@/lib/time";
import { proposalState, type ProposalState } from "@/lib/governance";
import { getHiddenIds } from "@/lib/moderation";
import { t, type Dictionary } from "@/lib/i18n";
import type { ProposalRow } from "@/lib/types/db";

export const metadata = {
  title: "Proposals & votes · Steppe",
};

type ListItem = Pick<
  ProposalRow,
  "id" | "title" | "kind" | "status" | "opens_at" | "closes_at"
>;

function windowLine(
  state: ProposalState,
  item: ListItem,
  locale: string,
  dict: Dictionary,
): string {
  if (state === "open")
    return t(dict.governance.windowOpenUntil, {
      date: formatRedmondDateTime(item.closes_at, locale),
    });
  if (state === "upcoming")
    return t(dict.governance.windowOpensAt, {
      date: formatRedmondDateTime(item.opens_at, locale),
    });
  return t(dict.governance.windowClosedAt, {
    date: formatRedmondDateTime(item.closes_at, locale),
  });
}

function ProposalCards({
  items,
  state,
  locale,
  dict,
}: {
  items: ListItem[];
  state: ProposalState;
  locale: string;
  dict: Dictionary;
}) {
  return (
    <ul className="flex flex-col gap-3">
      {items.map((p) => (
        <li key={p.id}>
          <Link
            href={`/protected/governance/${p.id}`}
            className="block rounded-lg border bg-card p-4 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h3 className="font-medium">{p.title}</h3>
              <Badge variant="outline">{dict.governance.kinds[p.kind]}</Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {windowLine(state, p, locale, dict)}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}

async function GovernanceContent() {
  const profile = await getMyProfile();
  if (!profile) redirect("/auth/login");

  const { locale, dict } = await getServerDictionary();

  if (!profile.verified) {
    return (
      <VerifiedGate
        title={dict.governance.gateTitle}
        body={dict.governance.gateBody}
        ctaLabel={dict.governance.gateCta}
        locale={locale}
      />
    );
  }

  const supabase = await createClient();
  const { data: proposals } = await supabase
    .from("proposals")
    .select("id, title, kind, status, opens_at, closes_at")
    .returns<ListItem[]>();

  // Hidden (moderator-removed) proposals drop out of the listing; their detail
  // page still shows the legible removed state (P7).
  const hidden = await getHiddenIds(supabase, "proposal");
  const all = (proposals ?? []).filter((p) => !hidden.has(p.id));
  const now = Date.now();
  const withState = all.map((p) => ({
    p,
    state: proposalState(p.opens_at, p.closes_at, p.status, now),
  }));

  // Grouped by state, each group in its own time order — no ranking, popularity,
  // or engagement signal (invariant 7). Open closing soonest first (most urgent);
  // upcoming opening soonest first; closed most-recently-closed first.
  const open = withState
    .filter((x) => x.state === "open")
    .map((x) => x.p)
    .sort((a, b) => Date.parse(a.closes_at) - Date.parse(b.closes_at));
  const upcoming = withState
    .filter((x) => x.state === "upcoming")
    .map((x) => x.p)
    .sort((a, b) => Date.parse(a.opens_at) - Date.parse(b.opens_at));
  const closed = withState
    .filter((x) => x.state === "closed")
    .map((x) => x.p)
    .sort((a, b) => Date.parse(b.closes_at) - Date.parse(a.closes_at));

  return (
    <div lang={locale} className="flex flex-col gap-8">
      <GovSegments active="proposals" dict={dict} />
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            {dict.governance.listTitle}
          </h1>
          <p className="text-sm text-muted-foreground">
            {dict.governance.listIntro}
          </p>
        </div>
        <Button asChild className="shrink-0">
          <Link href="/protected/governance/new">
            <FilePlus2 className="size-4" aria-hidden="true" />
            {dict.governance.create}
          </Link>
        </Button>
      </header>

      {all.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
          {dict.governance.empty}
        </p>
      ) : (
        <div className="flex flex-col gap-8">
          {open.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="text-sm font-medium text-muted-foreground">
                {dict.governance.openSection}
              </h2>
              <ProposalCards
                items={open}
                state="open"
                locale={locale}
                dict={dict}
              />
            </section>
          )}
          {upcoming.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="text-sm font-medium text-muted-foreground">
                {dict.governance.upcomingSection}
              </h2>
              <ProposalCards
                items={upcoming}
                state="upcoming"
                locale={locale}
                dict={dict}
              />
            </section>
          )}
          {closed.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="text-sm font-medium text-muted-foreground">
                {dict.governance.closedSection}
              </h2>
              <ProposalCards
                items={closed}
                state="closed"
                locale={locale}
                dict={dict}
              />
            </section>
          )}
        </div>
      )}
    </div>
  );
}

export default function GovernancePage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <GovernanceContent />
    </Suspense>
  );
}
