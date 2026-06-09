"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, isModerator } from "@/lib/auth";
import type { ModeratableTarget } from "@/lib/moderation";

export type ModerationState = { ok: true } | { error: string } | null;

/**
 * Hide ('remove') or un-hide ('restore') a piece of content, with a REQUIRED
 * written reason. This is the append-only, never-silent moderation act (P7/P19):
 * it inserts an immutable row into moderation_actions — never an edit, never a
 * delete. A reversal is a new 'restore' row, so the full history stays visible.
 *
 * Moderator-only: checked here for a friendly error and enforced by RLS
 * (mod_insert: is_moderator() and actor_id = auth.uid()). The DB also requires a
 * non-empty reason for remove/restore (a CHECK constraint), and the insert
 * auto-writes a public audit entry (trg_log_moderation). The content itself is
 * not deleted — its detail page shows a legible removed state.
 */
export async function moderateContent(
  targetType: ModeratableTarget,
  targetId: string,
  action: "remove" | "restore",
  reason: string,
): Promise<ModerationState> {
  const user = await getCurrentUser();
  if (!user) return { error: "unauthenticated" };
  if (!(await isModerator())) return { error: "forbidden" };
  if (action !== "remove" && action !== "restore") return { error: "bad-action" };
  if (targetType !== "event" && targetType !== "proposal") {
    return { error: "bad-target" };
  }
  const trimmed = reason.trim();
  if (!trimmed) return { error: "reason-required" };

  const supabase = await createClient();
  const { error } = await supabase.from("moderation_actions").insert({
    target_type: targetType,
    target_id: targetId,
    actor_id: user.id,
    action,
    reason: trimmed,
  });
  if (error) return { error: "moderate-failed" };

  const base =
    targetType === "event" ? "/protected/events" : "/protected/governance";
  revalidatePath(`${base}/${targetId}`);
  revalidatePath(base);
  revalidatePath("/protected");
  revalidatePath("/protected/transparency");
  return { ok: true };
}
