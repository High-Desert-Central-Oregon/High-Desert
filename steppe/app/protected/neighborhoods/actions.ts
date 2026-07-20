"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, isModerator } from "@/lib/auth";

export type NeighborhoodState =
  | { saved: true; cleared: boolean }
  | { error: string }
  | null;

export type ResolveState = { error: string } | null;

/**
 * Set (or clear) the signed-in member's neighborhood. neighborhood_id is a
 * self-declared attribute — it carries no trust or access weight, so the normal
 * profile update policy (own-row only) is the correct gate here. The frozen-
 * columns trigger (trg_guard_profile_columns) silently preserves verified, role,
 * and tenure_start on any profile update, so setting neighborhood_id can never
 * touch those fields even if the client tried (invariant 2).
 *
 * Two paths:
 *   • A real neighborhood id → set it. A DB trigger
 *     (trg_resolve_neighborhood_requests) auto-resolves any open help request,
 *     since the member's question is now answered.
 *   • "none" → leave neighborhood_id null AND open a neighborhood-help request
 *     (with the optional "where do you live?" note) so a moderator can follow up.
 *     This is a deliberate flag, distinct from "hasn't chosen yet."
 */
export async function setNeighborhood(
  _prev: NeighborhoodState,
  formData: FormData,
): Promise<NeighborhoodState> {
  const user = await getCurrentUser();
  if (!user) return { error: "unauthenticated" };

  const raw = formData.get("neighborhood_id");
  const isNone = !raw || raw === "none";
  const neighborhoodId = isNone ? null : String(raw);

  const supabase = await createClient();
  // Verify the write PERSISTED — mirror setFieldVisibility (account/actions.ts):
  // don't trust a no-error response. Read the written column back in the same
  // statement. A 0-row UPDATE (e.g. RLS matched nothing because auth.uid() wasn't
  // the row owner at write time) returns no rows, which `.single()` surfaces as a
  // PGRST116 error rather than success.
  const { data, error } = await supabase
    .from("profiles")
    .update({ neighborhood_id: neighborhoodId })
    .eq("id", user.id)
    .select("neighborhood_id")
    .single();

  if (error) {
    // PGRST116 = "no (or multiple) rows" from .single() — here, the UPDATE
    // touched no row: the write silently did not persist. Distinct code so the UI
    // can key on it; genuine DB faults stay "save-failed".
    return { error: error.code === "PGRST116" ? "not-persisted" : "save-failed" };
  }
  // Belt-and-suspenders: a row came back but the value isn't what we asked for
  // (null == null holds for the "none" path, which clears the column).
  if (
    (data as { neighborhood_id: string | null } | null)?.neighborhood_id !==
    neighborhoodId
  ) {
    return { error: "not-persisted" };
  }

  if (isNone) {
    const note = String(formData.get("note") ?? "").trim();
    // Open a help request. The partial unique index guarantees at most one open
    // request per member; if they already have one, that's success, not an error
    // (Ousterhout: define the error out of existence). 23505 = unique_violation.
    const { error: reqError } = await supabase
      .from("neighborhood_requests")
      .insert({
        user_id: user.id,
        note: note.length > 0 ? note : null,
        status: "open",
      });
    if (reqError && reqError.code !== "23505") {
      return { error: "save-failed" };
    }
  }

  revalidatePath("/protected");
  revalidatePath("/protected/neighborhoods");
  revalidatePath("/protected/review");
  return { saved: true, cleared: isNone };
}

/**
 * Mark a neighborhood-help request resolved. Moderator-only, the human-in-the-
 * loop follow-up (invariant 5) — a person has reached out and placed the member.
 * RLS (nr_update) re-checks is_moderator(); the stamp trigger records who/when.
 */
export async function resolveNeighborhoodRequest(
  requestId: string,
): Promise<ResolveState> {
  if (!(await isModerator())) return { error: "forbidden" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("neighborhood_requests")
    .update({ status: "resolved" })
    .eq("id", requestId)
    .eq("status", "open"); // no-op if already resolved

  if (error) return { error: "resolve-failed" };

  revalidatePath("/protected/review");
  return null;
}
