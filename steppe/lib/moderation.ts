import type { SupabaseClient } from "@supabase/supabase-js";
import type { ContentModerationRow } from "@/lib/types/db";

/**
 * Moderation is content-legible, never silent (CLAUDE.md P7/P19). A piece of
 * content is hidden when its LATEST remove/restore action is a 'remove'; a
 * reversal is always a new 'restore' row, so the append-only log is the whole
 * story and "is this hidden?" is just the top of the stack (the content_moderation
 * view). Hidden content is not deleted — its detail page shows a legible removed
 * state with the reason and that it's appealable.
 */
export type ModeratableTarget = "event" | "proposal" | "post";

export type ContentModeration = {
  hidden: boolean;
  /** The remove action's id (what an appeal is filed against), when hidden. */
  actionId: string;
  reason: string | null;
  at: string;
};

/**
 * Fetch the current moderation state of one piece of content. Returns null when
 * it has never been moderated. A small deep module: callers just learn
 * hidden/visible + the reason, not how the log is shaped.
 */
export async function getContentModeration(
  supabase: SupabaseClient,
  targetType: ModeratableTarget,
  targetId: string,
): Promise<ContentModeration | null> {
  const { data } = await supabase
    .from("content_moderation")
    .select("action_id, action, reason, created_at")
    .eq("target_type", targetType)
    .eq("target_id", targetId)
    .maybeSingle<
      Pick<ContentModerationRow, "action_id" | "action" | "reason" | "created_at">
    >();

  if (!data) return null;
  return {
    hidden: data.action === "remove",
    actionId: data.action_id,
    reason: data.reason,
    at: data.created_at,
  };
}

/**
 * The set of currently-hidden target ids of a given type — for filtering hidden
 * content out of list views in one query.
 */
export async function getHiddenIds(
  supabase: SupabaseClient,
  targetType: ModeratableTarget,
): Promise<Set<string>> {
  const { data } = await supabase
    .from("content_moderation")
    .select("target_id, action")
    .eq("target_type", targetType)
    .eq("action", "remove")
    .returns<{ target_id: string; action: string }[]>();
  return new Set((data ?? []).map((r) => r.target_id));
}
