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
 * The actual state change goes entirely through the `decide_verification` RPC,
 * which sets status + reviewed_by/at and, on approval, `verified` and
 * `tenure_start`, and writes the audit entry. We never set those columns here or
 * reimplement that logic (invariants 2, 5, 6). The RPC also re-checks
 * `is_moderator()` itself, so the guard below is defense in depth.
 *
 * Verify, then forget (invariant 1) is completed here in three ordered steps:
 * read the evidence pointer first (the purge trigger nulls it the instant the
 * status changes), make the decision, then delete the stored file — the DB drops
 * the pointer, this action drops the file.
 */
export async function decideVerification(
  verificationId: string,
  approve: boolean,
): Promise<DecisionState> {
  const supabase = await createClient();
  if (!(await isModerator())) return { error: "forbidden" };

  // 1. Capture the evidence path BEFORE deciding — once status changes, the
  //    purge trigger nulls it and it's gone from the row.
  const { data: row } = await supabase
    .from("verifications")
    .select("evidence_path")
    .eq("id", verificationId)
    .maybeSingle<{ evidence_path: string | null }>();
  const evidencePath = row?.evidence_path ?? null;

  // 2. The decision itself (RPC owns all the trust columns + the audit entry).
  const { error } = await supabase.rpc("decide_verification", {
    p_id: verificationId,
    p_approve: approve,
  });
  if (error) return { error: "decide-failed" };

  // 3. Delete the actual file. Deletion needs the service role (there is no
  //    moderator DELETE policy on the bucket). A cleanup hiccup must never undo
  //    a recorded decision or leave the member in limbo, so we log and proceed.
  if (evidencePath) {
    const { error: deleteError } = await createAdminClient()
      .storage.from(EVIDENCE_BUCKET)
      .remove([evidencePath]);
    if (deleteError) {
      console.error(
        `evidence cleanup failed for verification ${verificationId}: ${deleteError.message}`,
      );
    }
  }

  revalidatePath("/protected/review");
  return null;
}
