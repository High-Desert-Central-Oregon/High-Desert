"use client";
import { useActionState, useRef, useState } from "react";
import type { Locale } from "@/lib/i18n";
import { t } from "@/lib/i18n";
import { blocksCopy } from "@/lib/messages/blocks-copy";
import { DraftForm } from "@/components/draft-form";
import { FormError } from "@/components/form-error";
import { unblockMember } from "./actions";
export function UnblockForm({
  blockedId,
  name,
  locale,
}: {
  blockedId: string;
  name: string;
  locale: Locale;
}) {
  const copy = blocksCopy[locale];
  const [confirmed, setConfirmed] = useState(false);
  const [state, action, pending] = useActionState(unblockMember, null);
  const details = useRef<HTMLDetailsElement>(null);
  const summary = useRef<HTMLElement>(null);
  const form = useRef<HTMLFormElement>(null);
  return (
    <details ref={details} className="min-w-0 border bg-card p-4">
      <summary
        ref={summary}
        className="focus-ring min-h-11 cursor-pointer break-words py-3 font-semibold"
      >
        {t(copy.unblock, { name })}
      </summary>
      <DraftForm
        ref={form}
        action={action}
        aria-busy={pending}
        className="mt-3 flex flex-col gap-4"
      >
        <input type="hidden" name="blocked_id" value={blockedId} />
        <p className="text-sm">{copy.explanation}</p>
        <p className="text-sm">{copy.closed}</p>
        <p className="text-sm text-muted-foreground">{copy.notification}</p>
        {state && <FormError message={copy.failed} pending={pending} />}
        <label className="flex min-h-11 items-start gap-3 py-2 text-sm">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            name="confirm"
            value="1"
            required
            disabled={pending}
            className="focus-ring mt-1 size-4 shrink-0 accent-primary"
          />
          <span className="break-words">{t(copy.confirm, { name })}</span>
        </label>
        <div className="flex flex-wrap gap-3">
          <button
            disabled={pending}
            type="submit"
            className="focus-ring min-h-11 border bg-primary px-4 py-2 font-semibold text-primary-foreground disabled:opacity-60"
          >
            {pending ? copy.saving : t(copy.unblock, { name })}
          </button>
          <button
            disabled={pending}
            type="button"
            className="focus-ring min-h-11 border px-4 py-2"
            onClick={() => {
              form.current?.reset();
              setConfirmed(false);
              if (details.current) details.current.open = false;
              summary.current?.focus();
            }}
          >
            {copy.cancel}
          </button>
        </div>
      </DraftForm>
    </details>
  );
}
