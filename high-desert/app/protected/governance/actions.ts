"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/auth";
import { redmondWallTimeToUtcISO } from "@/lib/time";
import type { ProposalKind } from "@/lib/types/db";

export type ProposalFormState = { error: string } | null;

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
