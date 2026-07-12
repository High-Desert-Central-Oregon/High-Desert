"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, isModerator } from "@/lib/auth";
import type { ModeratableTarget } from "@/lib/moderation";

export type ModerationState = { ok: true } | { error: string } | null;
export type AppealState = { ok: true } | { error: string } | null;

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
  if (
    targetType !== "event" &&
    targetType !== "proposal" &&
    targetType !== "post"
  ) {
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
    targetType === "event"
      ? "/protected/events"
      : targetType === "post"
        ? "/protected/exchange"
        : "/protected/governance";
  revalidatePath(`${base}/${targetId}`);
  revalidatePath(base);
  // Events surface on the Exchange board too (the UNION feed).
  if (targetType === "event") revalidatePath("/protected/exchange");
  revalidatePath("/protected");
  revalidatePath("/protected/transparency");
  return { ok: true };
}

/**
 * File an appeal against a removal. The affected member's voice (P7). Routed
 * through the file_appeal() RPC, which enforces "only the affected member, one
 * appeal per action" server-side — neither is expressible as a simple RLS check.
 */
export async function fileAppeal(
  _prev: AppealState,
  formData: FormData,
): Promise<AppealState> {
  const user = await getCurrentUser();
  if (!user) return { error: "unauthenticated" };

  const actionId = String(formData.get("moderation_action_id") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const targetType = String(formData.get("target_type") ?? "").trim();
  const targetId = String(formData.get("target_id") ?? "").trim();
  if (!actionId) return { error: "bad-action" };
  if (!body) return { error: "body-required" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("file_appeal", {
    p_moderation_action_id: actionId,
    p_body: body,
  });
  if (error) return { error: "appeal-failed" };

  if (targetType === "event") {
    revalidatePath(`/protected/events/${targetId}`);
  } else if (targetType === "proposal") {
    revalidatePath(`/protected/governance/${targetId}`);
  }
  revalidatePath("/protected/moderation");
  revalidatePath("/protected");
  return { ok: true };
}

/**
 * Resolve an appeal: uphold the removal, or overturn it (which issues a 'restore'
 * action). Routed through resolve_appeal(), which enforces SEPARATION OF DUTIES —
 * a moderator can't resolve an appeal of their own action — and writes the
 * append-only outcome. The guard here is defense in depth; the RPC is the gate.
 */
export async function resolveAppeal(
  appealId: string,
  uphold: boolean,
  reason: string,
): Promise<{ error: string } | null> {
  if (!(await isModerator())) return { error: "forbidden" };
  const trimmed = reason.trim();
  if (!trimmed) return { error: "reason-required" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("resolve_appeal", {
    p_appeal_id: appealId,
    p_uphold: uphold,
    p_reason: trimmed,
  });
  if (error) return { error: "resolve-failed" };

  revalidatePath("/protected/moderation");
  revalidatePath("/protected/events");
  revalidatePath("/protected/governance");
  revalidatePath("/protected/transparency");
  revalidatePath("/protected");
  return null;
}
