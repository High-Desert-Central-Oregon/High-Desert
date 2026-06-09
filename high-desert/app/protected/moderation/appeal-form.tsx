"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { fileAppeal, type AppealState } from "./actions";
import type { ModeratableTarget } from "@/lib/moderation";
import type { Dictionary } from "@/lib/i18n";

/**
 * The affected member's appeal form, shown inside the removed-state banner. A
 * written statement is required. On success the page revalidates and the banner
 * shows the appeal's status instead of this form.
 */
export function AppealForm({
  actionId,
  targetType,
  targetId,
  dict,
}: {
  actionId: string;
  targetType: ModeratableTarget;
  targetId: string;
  dict: Dictionary;
}) {
  const [state, action, pending] = useActionState<AppealState, FormData>(
    fileAppeal,
    null,
  );

  if (state && "ok" in state) {
    return (
      <p role="status" className="text-sm text-muted-foreground">
        {dict.moderation.appealStatusOpen}
      </p>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="moderation_action_id" value={actionId} />
      <input type="hidden" name="target_type" value={targetType} />
      <input type="hidden" name="target_id" value={targetId} />
      <label htmlFor="appeal-body" className="text-sm font-medium">
        {dict.moderation.appealHeading}
      </label>
      <textarea
        id="appeal-body"
        name="body"
        rows={3}
        maxLength={2000}
        required
        placeholder={dict.moderation.appealPlaceholder}
        className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      />
      {state && "error" in state && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {dict.moderation.appealError}
        </p>
      )}
      <Button type="submit" size="sm" disabled={pending} className="self-start">
        {pending ? dict.moderation.appealSubmitting : dict.moderation.appealSubmit}
      </Button>
    </form>
  );
}
