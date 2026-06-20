"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentDocuments } from "@/lib/onboarding";

/** Form state: an error code on failure, or null. Success redirects instead. */
export type ConsentState = { error: string } | null;

/**
 * Record the signed-in member's agreement to every *current* Terms and Privacy
 * document, then send them into the app. Shaped for `useActionState`, but it
 * deliberately ignores the submitted `FormData` — which documents are current
 * and who the member is are both derived server-side from the session, never
 * trusted from the client.
 *
 * Trust rules honored here:
 *  - Runs with the member's own session, so Row-Level Security (`consents`
 *    insert: user_id = auth.uid()) is the real enforcement — no service-role
 *    bypass (CLAUDE.md "RLS-first").
 *  - `consents` is append-only; we only insert the rows still missing (inv. 6).
 *  - The database is the source of truth for consent, never localStorage (inv. 8).
 */
export async function acceptCurrentDocuments(
  _prev: ConsentState,
  _formData: FormData,
): Promise<ConsentState> {
  const supabase = await createClient();

  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) {
    return { error: "not-signed-in" };
  }

  const currentDocs = await getCurrentDocuments();
  if (currentDocs.length === 0) {
    // Nothing to consent to (documents not seeded) — don't trap the member.
    redirect("/protected");
  }

  // Insert only the documents this member hasn't already agreed to, so
  // re-consenting to a newly published version doesn't collide with old rows
  // (unique constraint is user_id + document_id).
  const { data: existing } = await supabase
    .from("consents")
    .select("document_id");
  const alreadyAgreed = new Set((existing ?? []).map((r) => r.document_id));

  const rows = currentDocs
    .filter((doc) => !alreadyAgreed.has(doc.id))
    .map((doc) => ({ user_id: userId, document_id: doc.id }));

  if (rows.length > 0) {
    const { error } = await supabase.from("consents").insert(rows);
    if (error) {
      // Surface the real cause in server logs instead of swallowing it — a bare
      // "save-failed" is undiagnosable. (A historical cause: signing in with a
      // mismatched OTP type produced a profile-less auth user, so this insert hit
      // the consents.user_id -> profiles foreign key; see scripts/login-link.mjs.)
      console.error("acceptCurrentDocuments: consents insert failed", {
        userId,
        code: error.code,
        message: error.message,
        details: error.details,
      });
      return { error: "save-failed" };
    }
  }

  redirect("/protected");
}
