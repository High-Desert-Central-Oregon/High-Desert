"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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
 * The state change goes entirely through the `decide_verification` RPC, which
 * sets status + reviewed_by/at and, on approval, `verified` and `tenure_start`,
 * and writes the audit entry. We never set those columns here or reimplement
 * that logic (invariants 2, 5, 6). The RPC also re-checks `is_moderator()`
 * itself, so the guard below is defense in depth.
 *
 * Verify, then forget (invariant 1), done in a *delete-before-commit* order so a
 * storage failure can never orphan a file:
 *   1. read the row's status + evidence pointer;
 *   2. act only if still 'pending' (so a retry can't double-decide / double-log);
 *   3. if there's a file, delete it FIRST via the service role — idempotent
 *      (an already-missing object is success); a genuine failure throws and we
 *      stop, leaving the row pending with its pointer intact for a clean retry;
 *   4. only then commit the decision — the RPC's trigger nulls the now-deleted
 *      pointer.
 *
 * The earlier order (decide, then delete) could orphan evidence: the trigger
 * nulled the pointer as part of the decision, so a later delete failure left the
 * file with nothing referencing it and no way to retry.
 */
export async function decideVerification(
  verificationId: string,
  approve: boolean,
): Promise<DecisionState> {
  const supabase = await createClient();
  if (!(await isModerator())) return { error: "forbidden" };

  // 1. Read current state (moderators may read any verification via RLS).
  const { data: row } = await supabase
    .from("verifications")
    .select("status, evidence_path")
    .eq("id", verificationId)
    .maybeSingle<{ status: string; evidence_path: string | null }>();

  // 2. Only ever act on a still-pending request. If it's already decided (or a
  //    retry after the RPC committed), do nothing — no duplicate audit entry —
  //    and just clear the now-stale row from the queue.
  if (!row || row.status !== "pending") {
    revalidatePath("/protected/review");
    return null;
  }

  // 3. Delete the evidence file BEFORE committing the decision. `remove` does
  //    not error on an already-missing object, so this is idempotent and safe to
  //    retry. A genuine failure (bad key, network) must STOP us here: we throw
  //    without calling the RPC, so the row stays pending with evidence_path
  //    intact and the whole thing can be retried cleanly — never an orphan.
  if (row.evidence_path) {
    const { error: deleteError } = await createAdminClient()
      .storage.from(EVIDENCE_BUCKET)
      .remove([row.evidence_path]);
    if (deleteError) {
      throw new Error(
        `verify-then-forget: failed to delete evidence for verification ${verificationId}; left pending for retry (${deleteError.message})`,
      );
    }
  }

  // 4. Commit the decision. The trigger nulls the (now-deleted) pointer.
  const { error } = await supabase.rpc("decide_verification", {
    p_id: verificationId,
    p_approve: approve,
  });
  if (error) return { error: "decide-failed" };

  revalidatePath("/protected/review");
  return null;
}
