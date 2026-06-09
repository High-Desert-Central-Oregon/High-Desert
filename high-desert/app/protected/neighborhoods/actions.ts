"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";

export type NeighborhoodState =
  | { saved: true; cleared: boolean }
  | { error: string }
  | null;

/**
 * Set (or clear) the signed-in member's neighborhood. neighborhood_id is a
 * self-declared attribute — it carries no trust or access weight, so the normal
 * profile update policy (own-row only) is the correct gate here. The frozen-
 * columns trigger (trg_guard_profile_columns) silently preserves verified, role,
 * and tenure_start on any profile update, so setting neighborhood_id can never
 * touch those fields even if the client tried (invariant 2).
 *
 * A null neighborhoodId means "none of these fit" — the member stays unplaced
 * and appears in the moderator's follow-up list (Part 2).
 */
export async function setNeighborhood(
  _prev: NeighborhoodState,
  formData: FormData,
): Promise<NeighborhoodState> {
  const user = await getCurrentUser();
  if (!user) return { error: "unauthenticated" };

  const raw = formData.get("neighborhood_id");
  const neighborhoodId =
    !raw || raw === "none" ? null : String(raw);

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ neighborhood_id: neighborhoodId })
    .eq("id", user.id);

  if (error) return { error: "save-failed" };

  revalidatePath("/protected");
  revalidatePath("/protected/neighborhoods");
  return { saved: true, cleared: neighborhoodId === null };
}
