"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
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
  if (!userId) return { error: "not-signed-in" };

  if (!isVerificationMethod(method)) return { error: "bad-method" };

  // Don't stack duplicate pending requests if the member double-submits.
  const { data: pending } = await supabase
    .from("verifications")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "pending")
    .limit(1)
    .maybeSingle();
  if (pending) redirect("/protected/verify");

  let path: string | null = evidencePath;
  if (isDocumentMethod(method)) {
    // Defense in depth: the pointer must live in the caller's own folder.
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
  if (error) return { error: "save-failed" };

  revalidatePath("/protected/verify");
  redirect("/protected/verify");
}
