import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CalendarClock, CalendarCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { VerifiedGate } from "@/components/verified-gate";
import { VoteForm } from "./vote-form";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/auth";
import { getServerDictionary } from "@/lib/i18n/server";
import { formatRedmondDateTime } from "@/lib/time";
import { proposalState } from "@/lib/governance";
import { t } from "@/lib/i18n";
import type { ProposalRow, VoteChoice } from "@/lib/types/db";

export const metadata = {
  title: "Proposal · High Desert",
};

async function ProposalDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

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

  // RLS (pr_read) returns proposals only to verified members; a missing row 404s.
  const { data: proposal } = await supabase
    .from("proposals")
    .select(
      "id, author_id, title, body, kind, status, opens_at, closes_at, created_at",
    )
    .eq("id", id)
    .maybeSingle<ProposalRow>();

  if (!proposal) notFound();

  const state = proposalState(
    proposal.opens_at,
    proposal.closes_at,
    proposal.status,
    Date.now(),
  );

  let authorName: string | null = null;
  if (proposal.author_id) {
    const { data: author } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", proposal.author_id)
      .maybeSingle<{ display_name: string }>();
    authorName = author?.display_name ?? null;
  }

  // The member's own current ballot, to prefill the form while open. RLS
  // (vt_select) returns ONLY the caller's own row — never anyone else's.
  let myChoice: VoteChoice | null = null;
  if (state === "open") {
    const { data: ballot } = await supabase
      .from("votes")
      .select("choice")
      .eq("proposal_id", proposal.id)
      .eq("user_id", profile.id)
      .maybeSingle<{ choice: VoteChoice }>();
    myChoice = ballot?.choice ?? null;
  }

  const stateBadgeVariant =
    state === "open" ? "default" : state === "upcoming" ? "secondary" : "outline";

  return (
    <article lang={locale} className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link
          href="/protected/governance"
          className="text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          {dict.governance.backToList}
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            {proposal.title}
          </h1>
          <div className="flex shrink-0 gap-2">
            <Badge variant="outline">{dict.governance.kinds[proposal.kind]}</Badge>
            <Badge variant={stateBadgeVariant}>
              {dict.governance.states[state]}
            </Badge>
          </div>
        </div>
        {authorName && (
          <p className="text-sm text-muted-foreground">
            {t(dict.governance.proposedBy, { name: authorName })}
          </p>
        )}
      </div>

      {/* Voting window */}
      <dl className="flex flex-col gap-3 rounded-lg border bg-card p-4 text-sm">
        <div className="flex items-start gap-2.5">
          <CalendarClock
            className="mt-0.5 size-4 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <div>
            <dt className="font-medium">{dict.governance.opensLabel}</dt>
            <dd className="text-muted-foreground">
              {formatRedmondDateTime(proposal.opens_at, locale)}
            </dd>
          </div>
        </div>
        <div className="flex items-start gap-2.5">
          <CalendarCheck
            className="mt-0.5 size-4 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <div>
            <dt className="font-medium">{dict.governance.closesLabel}</dt>
            <dd className="text-muted-foreground">
              {formatRedmondDateTime(proposal.closes_at, locale)}
            </dd>
          </div>
        </div>
      </dl>

      {proposal.body && (
        <div className="whitespace-pre-wrap text-sm leading-relaxed">
          {proposal.body}
        </div>
      )}

      {/* Voting — only while open. No tally is shown here (secret until close). */}
      {state === "open" && (
        <VoteForm
          proposalId={proposal.id}
          initialChoice={myChoice}
          dict={dict}
        />
      )}
      {state === "upcoming" && (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          {t(dict.governance.votingOpensNote, {
            date: formatRedmondDateTime(proposal.opens_at, locale),
          })}
        </p>
      )}
      {/* state === "closed": results render here in Part 4. */}
    </article>
  );
}

export default function ProposalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense>
      <ProposalDetail params={params} />
    </Suspense>
  );
}
