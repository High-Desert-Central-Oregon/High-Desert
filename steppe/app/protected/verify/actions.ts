"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import {
  pipelinesEnabled,
  deliverMemberNotices,
} from "@/lib/member-pipelines/server";
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

/** Revoke an unattached slot before Storage deletion; retry failures visibly. */
async function releaseOwnUpload(
  userId: string,
  path: string | null,
): Promise<boolean> {
  const session = await createClient();
  const released = await session.rpc("release_unused_verification_upload", {
    p_path: path,
  });
  if (released.error) return false;
  if (released.data === null) return true;
  if (
    typeof released.data !== "string" ||
    !released.data.startsWith(`${userId}/`)
  )
    return false;
  const { error } = await createAdminClient()
    .storage.from(EVIDENCE_BUCKET)
    .remove([released.data]);
  return !error;
}

export async function prepareVerificationUpload(
  extension: string,
): Promise<{ data: string | null; error: boolean }> {
  try {
    const session = await createClient();
    const { data, error } = await session.auth.getClaims();
    const uid = data?.claims?.sub;
    if (
      error ||
      !uid ||
      !["jpg", "png", "webp", "heic", "pdf"].includes(extension)
    )
      return { data: null, error: true };
    if (!(await releaseOwnUpload(uid, null)))
      return { data: null, error: true };
    const slot = await session.rpc("reserve_verification_upload", {
      p_extension: extension,
    });
    if (
      slot.error ||
      typeof slot.data !== "string" ||
      !slot.data.startsWith(`${uid}/`)
    )
      return { data: null, error: true };
    return { data: slot.data, error: false };
  } catch {
    return { data: null, error: true };
  }
}

async function discardOwnUpload(
  userId: string,
  path: string | null,
): Promise<void> {
  if (!path || !path.startsWith(`${userId}/`)) return;
  try {
    if (!(await releaseOwnUpload(userId, path)))
      console.error("verification evidence cleanup pending");
  } catch {
    console.error("verification evidence cleanup pending");
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
    if (!path || !path.startsWith(`${userId}/`))
      return { error: "bad-evidence" };
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
  if (pipelinesEnabled())
    after(async () => {
      try {
        await deliverMemberNotices();
      } catch {
        console.error("[member-pipelines] verification notice pending");
      }
    });
  redirect("/protected/verify");
}
