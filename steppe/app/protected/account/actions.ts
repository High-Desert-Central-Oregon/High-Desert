"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  completeAccountRemoval,
  type RemovalJob,
} from "@/lib/member-pipelines/removal";
import { getCurrentUser } from "@/lib/auth";
import type { FieldVisibility } from "@/lib/types/db";

export type DeleteState = { error: string } | null;

export type ProfileState = { saved: true } | { error: string } | null;

const MAX_NAME = 80;

/**
 * Save the signed-in member's display_name — the always-public handle (Y1/Y2:
 * the one field that can't be hidden, so authorship stays attributable). Written
 * through pf_update (own row only); the frozen-columns trigger keeps
 * verified/role/tenure untouchable even here (invariant 2). The name is the
 * member-chosen, non-legal handle — never their legal identity (invariant 1).
 */
export async function updateDisplayName(
  _prev: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const user = await getCurrentUser();
  if (!user) return { error: "unauthenticated" };

  const name = String(formData.get("display_name") ?? "").trim();
  if (name.length === 0) return { error: "name-required" };
  if (name.length > MAX_NAME) return { error: "name-too-long" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({ display_name: name })
    .eq("id", user.id)
    .select("display_name")
    .single();
  if (error || data?.display_name !== name) return { error: "save-failed" };

  revalidatePath("/protected/account");
  revalidatePath("/protected/account/profile");
  return { saved: true };
}

/**
 * Set the visibility of ONE profile field — "reveal one at a time" (cDB). Each
 * field is its own two-state control (Hidden ↔ Visible to members); there is
 * deliberately no bulk "make everything visible" (the dark pattern cDB is
 * written against). Default is 'hidden' — the promise. Written through pf_update
 * (own row); trust columns stay frozen. Today the one hideable personal field is
 * `neighborhood_visibility`; the field name is allow-listed so this action can
 * never be steered at a non-visibility column.
 */
const VISIBILITY_FIELDS = ["neighborhood_visibility"] as const;
type VisibilityField = (typeof VISIBILITY_FIELDS)[number];

export async function setFieldVisibility(
  _prev: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const user = await getCurrentUser();
  if (!user) return { error: "unauthenticated" };

  const field = String(formData.get("field") ?? "");
  const visibility = String(formData.get("visibility") ?? "");
  if (!VISIBILITY_FIELDS.includes(field as VisibilityField)) {
    return { error: "unknown-field" };
  }
  if (visibility !== "hidden" && visibility !== "members") {
    return { error: "bad-visibility" };
  }

  const supabase = await createClient();
  // Verify the write PERSISTED — do not trust a no-error response. Read the
  // written column back in the same statement. A 0-row UPDATE (e.g. RLS matched
  // nothing because auth.uid() wasn't the row owner at write time) returns no
  // rows, which `.single()` surfaces as a PGRST116 error rather than success.
  const { data, error } = await supabase
    .from("profiles")
    .update({ [field]: visibility as FieldVisibility })
    .eq("id", user.id)
    .select(field)
    .single();

  if (error) {
    // PGRST116 = "no (or multiple) rows" from .single() — here, the UPDATE
    // touched no row: the write silently did not persist. Distinct code so the
    // separate auth-context track can key on it; genuine DB faults stay
    // "save-failed".
    return {
      error: error.code === "PGRST116" ? "not-persisted" : "save-failed",
    };
  }
  // Belt-and-suspenders: a row came back but the value isn't what we asked for.
  if (
    (data as unknown as Record<string, string> | null)?.[field] !== visibility
  ) {
    return { error: "not-persisted" };
  }

  revalidatePath("/protected/account/profile");
  return { saved: true };
}

/** Deactivate immediately; acknowledge deletion only after durable Storage/Auth
 * cleanup completes. A retained session may retry its own tombstoned account.
 */
export async function deleteMyAccount(): Promise<DeleteState> {
  const supabase = await createClient();
  const { data: claims, error: claimsError } = await supabase.auth.getClaims();
  const uid = claims?.claims?.sub;
  if (claimsError || !uid) redirect("/auth/login");
  const { error: rpcError } = await supabase.rpc("delete_my_account");
  if (rpcError) return { error: "delete-failed" };
  const { data, error } = await supabase.rpc("my_account_removal");
  const job = data?.[0] as RemovalJob | undefined;
  if (error || !job || job.target_id !== uid)
    return { error: "cleanup-pending" };
  try {
    if (!(await completeAccountRemoval(job)))
      return { error: "cleanup-pending" };
  } catch {
    return { error: "cleanup-pending" };
  }
  await supabase.auth.signOut();
  redirect("/?farewell=1");
}
