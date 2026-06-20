import { AppealForm } from "./appeal-form";
import { createClient } from "@/lib/supabase/server";
import type { ModeratableTarget } from "@/lib/moderation";
import type { AppealStatus } from "@/lib/types/db";
import type { Dictionary } from "@/lib/i18n";

/**
 * The appeal affordance inside a removed-state banner. Three states:
 *   • an appeal already exists  → show its outcome (open / upheld / overturned);
 *   • the viewer is the affected member, no appeal yet → show the appeal form;
 *   • anyone else → a plain "this is appealable" note.
 * RLS (ap_read) returns an appeal only to its author or a moderator, so a passer-by
 * never learns whether someone appealed.
 */
export async function AppealArea({
  actionId,
  targetType,
  targetId,
  isOwner,
  dict,
}: {
  actionId: string;
  targetType: ModeratableTarget;
  targetId: string;
  isOwner: boolean;
  dict: Dictionary;
}) {
  const supabase = await createClient();
  const { data: appeal } = await supabase
    .from("appeals")
    .select("status")
    .eq("moderation_action_id", actionId)
    .maybeSingle<{ status: AppealStatus }>();

  if (appeal) {
    const message =
      appeal.status === "open"
        ? dict.moderation.appealStatusOpen
        : appeal.status === "upheld"
          ? dict.moderation.appealStatusUpheld
          : dict.moderation.appealStatusOverturned;
    return <p className="text-sm text-muted-foreground">{message}</p>;
  }

  if (isOwner) {
    return (
      <AppealForm
        actionId={actionId}
        targetType={targetType}
        targetId={targetId}
        dict={dict}
      />
    );
  }

  return (
    <p className="text-sm text-muted-foreground">{dict.moderation.appealable}</p>
  );
}
