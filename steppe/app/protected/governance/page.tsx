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
import { Masthead } from "@/components/broadsheet/masthead";
import { SectionLabel, SectionRow } from "@/components/broadsheet/section-row";
import { Fab } from "@/components/broadsheet/fab";
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
    <ul className="flex flex-col border-t">
      {items.map((p) => (
        <li key={p.id}>
          {/* Preview ballot-row anatomy: mono kicker (TYPE · STATE), Besley
              title, quiet window line, rust chevron. */}
          <SectionRow
            href={`/protected/governance/${p.id}`}
            kicker={`${dict.governance.kinds[p.kind]} · ${dict.governance.states[state]}`}
            title={p.title}
            sub={windowLine(state, p, locale, dict)}
          />
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
      {/* Preview masthead grammar: the bundle's Govern dateline; the voice
          drops the not-yet-true turnout clause (parity G1). Create = the chip. */}
      <Masthead
        title={dict.nav.governanceLink}
        kicker={dict.governance.dateline}
        voice={dict.governance.voice}
      />
      <Fab href="/protected/governance/new" label={dict.governance.create} />

      {all.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
          {dict.governance.empty}
        </p>
      ) : (
        <div className="flex flex-col gap-8">
          {open.length > 0 && (
            <section className="flex flex-col gap-1">
              <SectionLabel>{dict.governance.openSection}</SectionLabel>
              <ProposalCards
                items={open}
                state="open"
                locale={locale}
                dict={dict}
              />
            </section>
          )}
          {upcoming.length > 0 && (
            <section className="flex flex-col gap-1">
              <SectionLabel>{dict.governance.upcomingSection}</SectionLabel>
              <ProposalCards
                items={upcoming}
                state="upcoming"
                locale={locale}
                dict={dict}
              />
            </section>
          )}
          {closed.length > 0 && (
            <section className="flex flex-col gap-1">
              <SectionLabel>{dict.governance.closedSection}</SectionLabel>
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
