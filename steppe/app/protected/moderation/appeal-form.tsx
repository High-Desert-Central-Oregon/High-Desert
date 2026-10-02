"use client";

import { useActionState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { DraftForm } from "@/components/draft-form";
import { FormError } from "@/components/form-error";
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
  const receipt = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (state && "ok" in state) receipt.current?.focus();
  }, [state]);

  if (state && "ok" in state) {
    return (
      <p
        ref={receipt}
        role="status"
        tabIndex={-1}
        className="focus-ring text-sm text-muted-foreground"
      >
        {dict.moderation.appealStatusOpen}
      </p>
    );
  }

  return (
    <DraftForm action={action} className="flex flex-col gap-2">
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
        disabled={pending}
        placeholder={dict.moderation.appealPlaceholder}
        className="field-control focus-ring w-full rounded-md border border-input bg-transparent px-3 py-2 text-base md:text-sm shadow-sm placeholder:text-muted-foreground"
      />
      {state && "error" in state && (
        <FormError message={dict.moderation.appealError} pending={pending} />
      )}
      <Button type="submit" size="sm" disabled={pending} className="self-start">
        {pending ? dict.moderation.appealSubmitting : dict.moderation.appealSubmit}
      </Button>
    </DraftForm>
  );
}
