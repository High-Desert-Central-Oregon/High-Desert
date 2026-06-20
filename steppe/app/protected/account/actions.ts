"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";

export type DeleteState = { error: string } | null;

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
