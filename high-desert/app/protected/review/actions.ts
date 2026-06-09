"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isModerator } from "@/lib/auth";
import { EVIDENCE_BUCKET } from "@/lib/verification";

export type DecisionState = { error: string } | null;
export type SignedUrlResult = { url: string } | { error: string };

/**
 * Mint a short-lived signed URL so a moderator can view a piece of verification
 * evidence from the PRIVATE bucket. Generated on demand (not baked into the page)
 * so the link is always fresh and expires in seconds. Authority is checked twice:
 * here, and again by the storage "moderators only" read policy.
 */
export async function createEvidenceSignedUrl(
  verificationId: string,
): Promise<SignedUrlResult> {
  const supabase = await createClient();
  if (!(await isModerator())) return { error: "forbidden" };

  const { data: row } = await supabase
    .from("verifications")
    .select("evidence_path")
    .eq("id", verificationId)
    .maybeSingle<{ evidence_path: string | null }>();

  const path = row?.evidence_path;
  if (!path) return { error: "no-evidence" };

  const { data, error } = await supabase.storage
    .from(EVIDENCE_BUCKET)
    .createSignedUrl(path, 60); // 60 seconds is plenty to open it
  if (error || !data?.signedUrl) return { error: "sign-failed" };

  return { url: data.signedUrl };
}

/**
 * Approve or reject a pending verification. The decision is the consequential,
 * human-in-the-loop act (invariant 5): a moderator clicks, a person decides.
 *
 * The actual state change goes entirely through the `decide_verification` RPC,
 * which sets status + reviewed_by/at and, on approval, `verified` and
 * `tenure_start`, and writes the audit entry. We never set those columns here or
 * reimplement that logic (invariants 2, 5, 6). The RPC also re-checks
 * `is_moderator()` itself, so the guard below is defense in depth.
 *
 * NOTE: the purge trigger nulls `evidence_path` on this decision, but the stored
 * file itself is deleted in part 3 (verify-then-forget completed).
 */
export async function decideVerification(
  verificationId: string,
  approve: boolean,
): Promise<DecisionState> {
  const supabase = await createClient();
  if (!(await isModerator())) return { error: "forbidden" };

  const { error } = await supabase.rpc("decide_verification", {
    p_id: verificationId,
    p_approve: approve,
  });
  if (error) return { error: "decide-failed" };

  revalidatePath("/protected/review");
  return null;
}
