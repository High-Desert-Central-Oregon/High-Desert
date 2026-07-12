import { Ban } from "lucide-react";
import type { ReactNode } from "react";
import type { ModeratableTarget } from "@/lib/moderation";
import type { Dictionary } from "@/lib/i18n";

/**
 * The legible "removed" state shown in place of moderated content — never a
 * silent disappearance (P7). It names that a moderator removed it, shows the
 * required reason, and (via `children`, wired in Part 3) carries the appeal
 * affordance. The original title/body are deliberately NOT shown, so removal
 * doesn't re-expose what was taken down.
 */
export function RemovedBanner({
  targetType,
  reason,
  dict,
  children,
}: {
  targetType: ModeratableTarget;
  reason: string | null;
  dict: Dictionary;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-5">
      <div className="flex items-start gap-2.5">
        <Ban
          className="mt-0.5 size-5 shrink-0 text-destructive"
          aria-hidden="true"
        />
        <div className="flex flex-col gap-1">
          <h2 className="font-semibold">
            {targetType === "event"
              ? dict.moderation.removedTitleEvent
              : targetType === "post"
                ? dict.moderation.removedTitlePost
                : dict.moderation.removedTitleProposal}
          </h2>
          {reason && (
            <p className="text-sm">
              <span className="text-muted-foreground">
                {dict.moderation.removedReason}:{" "}
              </span>
              {reason}
            </p>
          )}
        </div>
      </div>
      {children ?? (
        <p className="text-sm text-muted-foreground">
          {dict.moderation.appealable}
        </p>
      )}
    </div>
  );
}
