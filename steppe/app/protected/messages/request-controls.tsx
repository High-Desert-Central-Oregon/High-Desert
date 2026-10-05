"use client";
import { useActionState } from "react";
import { DraftForm } from "@/components/draft-form";
import { FormError } from "@/components/form-error";
import type { Locale } from "@/lib/i18n";
import { consentCopy } from "@/lib/messages/consent-copy";
import type { MessageActionState } from "@/lib/messages/action-result";
import { respondToRequest } from "./actions";
export function RequestControls({
  threadId,
  locale,
}: {
  threadId: string;
  locale: Locale;
}) {
  const copy = consentCopy[locale];
  const [state, action, pending] = useActionState<MessageActionState, FormData>(
    respondToRequest,
    null,
  );
  return (
    <DraftForm
      action={action}
      className="flex flex-col gap-3 border-t bg-muted p-4"
    >
      <input type="hidden" name="thread_id" value={threadId} />
      <p className="text-sm">{copy.incoming}</p>
      {state?.error && (
        <FormError message={copy.decisionFailed} pending={pending} />
      )}
      <fieldset disabled={pending} className="flex flex-wrap gap-3">
        {(["accept", "decline", "block"] as const).map((value) => (
          <button
            key={value}
            type="submit"
            name="response"
            value={value}
            className={`min-h-11 border px-4 py-2 font-semibold focus-ring ${value === "accept" ? "bg-primary text-primary-foreground" : ""}`}
          >
            {pending ? copy.saving : copy[value]}
          </button>
        ))}
      </fieldset>
    </DraftForm>
  );
}
