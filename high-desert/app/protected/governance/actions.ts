"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile, isModerator } from "@/lib/auth";
import { redmondWallTimeToUtcISO } from "@/lib/time";
import type { ProposalKind } from "@/lib/types/db";

export type ProposalFormState = { error: string } | null;
export type VoteState = { ok: true } | { error: string } | null;

const KINDS: ProposalKind[] = ["minor", "major", "immutable"];

/**
 * Create a proposal. Verified members only — checked here for a friendly error
 * and enforced by RLS (pr_insert: is_verified() and author_id = auth.uid()). The
 * voting window is entered as Redmond wall-clock time and converted server-side
 * to precise instants (lib/time.ts), so a wrong close time can't slip in from a
 * creator in another timezone.
 *
 * Records `proposal.created` in the append-only audit log (public, no PII).
 * Reversing a decision later happens through a NEW proposal — history is never
 * edited (invariant 6).
 */
export async function createProposal(
  _prev: ProposalFormState,
  formData: FormData,
): Promise<ProposalFormState> {
  const profile = await getMyProfile();
  if (!profile) redirect("/auth/login");
  if (!profile.verified) return { error: "forbidden" };

  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const kindRaw = String(formData.get("kind") ?? "minor").trim();
  const opensRaw = String(formData.get("opens_at") ?? "").trim();
  const closesRaw = String(formData.get("closes_at") ?? "").trim();

  if (!title) return { error: "title-required" };

  const kind: ProposalKind = (KINDS as string[]).includes(kindRaw)
    ? (kindRaw as ProposalKind)
    : "minor";

  const opensIso = redmondWallTimeToUtcISO(opensRaw);
  const closesIso = redmondWallTimeToUtcISO(closesRaw);
  if (!opensIso || !closesIso) return { error: "window-required" };
  if (Date.parse(closesIso) <= Date.parse(opensIso)) {
    return { error: "window-order" };
  }
  if (Date.parse(closesIso) <= Date.now()) return { error: "closes-past" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("proposals")
    .insert({
      author_id: profile.id,
      title,
      body: body.length > 0 ? body : null,
      kind,
      opens_at: opensIso,
      closes_at: closesIso,
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !data) return { error: "create-failed" };

  // Append-only audit (no PII). Best-effort: the proposal already exists.
  await supabase.rpc("log_audit", {
    p_action: "proposal.created",
    p_entity: "proposal",
    p_entity_id: data.id,
    p_metadata: { kind },
  });

  revalidatePath("/protected/governance");
  redirect(`/protected/governance/${data.id}`);
}

/**
 * Cast or change a secret ballot. One row per member (upsert on
 * proposal_id+user_id); the member may overwrite it while the proposal is open
 * and never after — all enforced in RLS (vt_insert/vt_update), not here. The
 * weight is set server-side from tenure by the set_vote_weight trigger; the
 * client sends only a choice. We deliberately write NOTHING to the audit log:
 * recording the choice would defeat the secret ballot (invariant 4). The votes
 * table, gated by RLS, is the only record of a ballot.
 */
export async function castVote(
  _prev: VoteState,
  formData: FormData,
): Promise<VoteState> {
  const profile = await getMyProfile();
  if (!profile) redirect("/auth/login");
  if (!profile.verified) return { error: "forbidden" };

  const proposalId = String(formData.get("proposal_id") ?? "").trim();
  const choice = String(formData.get("choice") ?? "").trim();
  if (!proposalId) return { error: "bad-proposal" };
  if (choice !== "yes" && choice !== "no" && choice !== "abstain") {
    return { error: "bad-choice" };
  }

  const supabase = await createClient();
  // The hard gates are RLS: verified, own row, proposal still open. The trigger
  // pins user_id and weight. No .select() back — nothing to read, nothing to leak.
  const { error } = await supabase
    .from("votes")
    .upsert(
      { proposal_id: proposalId, choice },
      { onConflict: "proposal_id,user_id" },
    );

  if (error) return { error: "vote-failed" };

  revalidatePath(`/protected/governance/${proposalId}`);
  return { ok: true };
}

/**
 * Record the official close of a proposal whose voting window has passed. The
 * human-in-the-loop finalization (invariant 5): results are already visible by
 * time (proposal_results shows any proposal past closes_at), but a moderator
 * marks it formally closed and writes the permanent audit entry.
 *
 * The audit carries the AGGREGATE result only (turnout + weighted totals) —
 * never any per-ballot data, which would defeat the secret ballot. Idempotent:
 * a proposal already closed is a no-op, so the close is audited exactly once.
 * Reversing a decision happens through a NEW proposal — history is never edited.
 */
export async function recordProposalClose(
  proposalId: string,
): Promise<{ error: string } | null> {
  if (!(await isModerator())) return { error: "forbidden" };

  const supabase = await createClient();
  const { data: proposal } = await supabase
    .from("proposals")
    .select("status, closes_at")
    .eq("id", proposalId)
    .maybeSingle<{ status: string; closes_at: string }>();

  if (!proposal) return { error: "not-found" };
  if (proposal.status === "closed") {
    revalidatePath(`/protected/governance/${proposalId}`);
    return null; // already officially closed — don't double-audit
  }
  if (Date.parse(proposal.closes_at) > Date.now()) {
    return { error: "not-yet-closed" }; // window still open; no early close here
  }

  // Aggregate result only (the view exposes it because the window has passed).
  const { data: result } = await supabase
    .from("proposal_results")
    .select("ballots, yes_weight, no_weight, abstain_weight")
    .eq("proposal_id", proposalId)
    .maybeSingle<{
      ballots: number;
      yes_weight: number;
      no_weight: number;
      abstain_weight: number;
    }>();

  const { error: upError } = await supabase
    .from("proposals")
    .update({ status: "closed" })
    .eq("id", proposalId);
  if (upError) return { error: "close-failed" };

  // Append-only audit, aggregate only — no per-ballot data.
  await supabase.rpc("log_audit", {
    p_action: "proposal.closed",
    p_entity: "proposal",
    p_entity_id: proposalId,
    p_metadata: result ?? {},
  });

  revalidatePath(`/protected/governance/${proposalId}`);
  return null;
}
