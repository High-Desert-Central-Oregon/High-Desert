"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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
  const { error } = await supabase
    .from("profiles")
    .update({ display_name: name })
    .eq("id", user.id);
  if (error) return { error: "save-failed" };

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
    return { error: error.code === "PGRST116" ? "not-persisted" : "save-failed" };
  }
  // Belt-and-suspenders: a row came back but the value isn't what we asked for.
  if ((data as unknown as Record<string, string> | null)?.[field] !== visibility) {
    return { error: "not-persisted" };
  }

  revalidatePath("/protected/account/profile");
  return { saved: true };
}

/**
 * Delete the signed-in member's account: erase the person, never rewrite the
 * tamper-evident record (CLAUDE.md invariants 6 + 8; Pattern 16).
 *
 * Three steps, in this order so a member's data is gone before their login is:
 *   1. delete_my_account() — a self-pinned SECURITY DEFINER RPC that erases the
 *      personal rows and scrubs the profile's PII, while KEEPING votes /
 *      moderation_actions / audit_log / proposals (re-anchored to a "Former
 *      member" tombstone). It acts only on auth.uid(), so it can only ever erase
 *      the caller's own account.
 *   2. the service-role admin client scrubs what RLS/the trust-guard keep out of
 *      reach: the guarded trust fields (verified/role/tenure_start) and the auth
 *      identity itself. The admin client has no auth.uid(), so the self-edit
 *      guard doesn't fire — we scrub the trust fields without ever loosening the
 *      guard. We do NOT hard-delete the auth user: that would CASCADE the
 *      profile and the votes. We anonymise + permanently ban instead.
 *   3. sign out and head home.
 *
 * Reversal is impossible by design — this is the real "take it and leave".
 */
export async function deleteMyAccount(): Promise<DeleteState> {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");

  const supabase = await createClient();

  // 1 · Erase the app-schema data (self-pinned in the DB).
  const { error: rpcError } = await supabase.rpc("delete_my_account");
  if (rpcError) return { error: "delete-failed" };

  // 2 · Finish what the member's own session can't reach. Best-effort: the data
  //     is already erased above; if the service role is unconfigured we still log
  //     the member out rather than leave them in a half-deleted, usable session.
  try {
    const admin = createAdminClient();
    // Scrub the guarded trust fields (admin bypasses RLS + the self-edit guard).
    await admin
      .from("profiles")
      .update({ verified: false, role: "member", tenure_start: null })
      .eq("id", user.id);
    // Anonymise + permanently disable the login WITHOUT deleting the auth row
    // (a hard delete would cascade the profile and the preserved votes).
    await admin.auth.admin.updateUserById(user.id, {
      email: `deleted+${user.id}@deleted.invalid`,
      password: crypto.randomUUID(),
      user_metadata: {},
      app_metadata: {},
      ban_duration: "876000h", // ~100 years
    });
  } catch (e) {
    console.error("account deletion: auth-identity scrub failed", e);
  }

  // 3 · End the session, then leave the protected area.
  await supabase.auth.signOut();
  redirect("/?farewell=1");
}
