"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  EVIDENCE_BUCKET,
  isDocumentMethod,
  isVerificationMethod,
  type VerificationMethod,
} from "@/lib/verification";

export type SubmitState = { error: string } | null;

/**
 * Whether the signed-in member already has a residency verification awaiting
 * review. The verify form calls this BEFORE it uploads any evidence: if a
 * request is already pending there is nothing to submit, so the form must not
 * write a file into the private evidence bucket that `submitVerification` would
 * then refuse to record — that would strand an object with no referencing row
 * (verify-then-forget; onboarding audit O3).
 *
 * A cheap existence check by design: `head: true` asks only whether such a row
 * exists (a COUNT, no row body returned), never reads the request itself. RLS
 * scopes the query to the caller's own rows, and `submitVerification` re-runs
 * the same guard server-side, so this is a UX short-circuit, not the authority.
 */
export async function hasPendingVerification(): Promise<boolean> {
  const supabase = await createClient();

  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return false;

  const { count } = await supabase
    .from("verifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "pending");

  return (count ?? 0) > 0;
}

/**
 * Best-effort removal of an evidence object the browser already uploaded, on the
 * paths where submitVerification decides NOT to record a row (a duplicate, a
 * save failure, a tampered method). Verify-then-forget: an uploaded file must
 * not outlive the request it was meant for (audit O3 — the cleanup half; the
 * pre-upload check in verify-form.tsx handles the common resubmit case).
 *
 * SCOPED TO THE CALLER'S OWN FOLDER. The delete runs through the service-role
 * admin client because members hold no DELETE on the bucket (migration 0016) —
 * the same deleter decideVerification uses. Because that client bypasses RLS, a
 * raw client-supplied path would be an arbitrary-object delete; guarding on the
 * `<userId>/…` prefix — the same boundary the upload policy enforces — means a
 * caller can only ever remove its own upload.
 *
 * BEST-EFFORT. A failed delete is logged server-side (never the evidence itself)
 * and swallowed, so the branch's own return/redirect is never blocked: worst
 * case the object stays orphaned, exactly as before this fix — never a stuck
 * member.
 */
async function discardOwnUpload(
  userId: string,
  path: string | null,
): Promise<void> {
  if (!path || !path.startsWith(`${userId}/`)) return;
  try {
    const { error } = await createAdminClient()
      .storage.from(EVIDENCE_BUCKET)
      .remove([path]);
    if (error) {
      console.error(
        "submitVerification: evidence cleanup failed; object may be orphaned",
        { storageError: error.message },
      );
    }
  } catch (e) {
    console.error(
      "submitVerification: evidence cleanup threw; object may be orphaned",
      e,
    );
  }
}

/**
 * Record a pending residency-verification request for the signed-in member.
 *
 * The evidence file (for document methods) is uploaded directly from the browser
 * into the member's own `<uid>/…` storage folder — the storage own-folder policy
 * is the gate there. This action only validates and records the pointer:
 *  - identity (`user_id`) and `status: 'pending'` are set server-side from the
 *    session, and Row-Level Security (`vf_insert`) re-checks both, so a client
 *    cannot insert someone else's row or pre-approve itself (invariants 2, 5);
 *  - document methods must reference a path inside the caller's own folder;
 *  - the postcard path carries no evidence at all.
 *
 * No trust is granted here — only a request to be reviewed by a human.
 */
export async function submitVerification(
  method: VerificationMethod,
  evidencePath: string | null,
): Promise<SubmitState> {
  const supabase = await createClient();

  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  // No cleanup here on purpose: without a trusted session there is no owner id to
  // scope the delete to, and removing a raw client-supplied path via the admin
  // client would be an arbitrary-object delete. This branch only fires if the
  // session lapsed between the browser upload and this call; the rare orphan it
  // leaves is the same as before the fix. Every branch below has a verified
  // userId and its own upload IS cleaned.
  if (!userId) return { error: "not-signed-in" };

  if (!isVerificationMethod(method)) {
    await discardOwnUpload(userId, evidencePath);
    return { error: "bad-method" };
  }

  // Don't stack duplicate pending requests if the member double-submits.
  const { data: pending } = await supabase
    .from("verifications")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "pending")
    .limit(1)
    .maybeSingle();
  if (pending) {
    // Already awaiting review — drop the just-uploaded file before sending the
    // member to their pending state, so it can't linger unreferenced. (The
    // pre-upload check usually prevents reaching here with an upload; this covers
    // the race where a pending row appears after that check.)
    await discardOwnUpload(userId, evidencePath);
    redirect("/protected/verify");
  }

  let path: string | null = evidencePath;
  if (isDocumentMethod(method)) {
    // Defense in depth: the pointer must live in the caller's own folder. No
    // cleanup delete here on purpose — by definition this path is NOT the
    // caller's `<userId>/…` folder, so removing it would mean deleting a path we
    // can't prove the caller owns. A legitimate upload always lands in the own
    // folder (the storage insert policy enforces it), so this is tamper-only;
    // the real orphan, if any, sits at a key the client never sent us.
    if (!path || !path.startsWith(`${userId}/`)) return { error: "bad-evidence" };
  } else {
    path = null; // postcard path keeps no evidence
  }

  const { error } = await supabase.from("verifications").insert({
    user_id: userId,
    method,
    status: "pending",
    evidence_path: path,
  });
  if (error) {
    // The upload succeeded but the row didn't land — drop the file so it isn't
    // stranded. (No-op for the postcard path, where `path` is null.)
    await discardOwnUpload(userId, path);
    return { error: "save-failed" };
  }

  revalidatePath("/protected/verify");
  redirect("/protected/verify");
}
