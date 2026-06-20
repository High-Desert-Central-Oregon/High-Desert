"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createProposal, type ProposalFormState } from "../actions";
import type { Dictionary } from "@/lib/i18n";

function errorMessage(state: ProposalFormState, dict: Dictionary): string | null {
  if (!state || !("error" in state)) return null;
  if (state.error === "title-required") return dict.governance.titleRequired;
  if (state.error === "window-required") return dict.governance.windowRequired;
  if (state.error === "window-order") return dict.governance.windowOrder;
  if (state.error === "closes-past") return dict.governance.closesPast;
  return dict.governance.errorGeneric;
}

/**
 * Create-proposal form. The open/close times are entered as plain wall-clock
 * values and read by the server as Redmond time (lib/time.ts), never the
 * browser's clock — the same guarantee as events, and it matters more here
 * because the close time decides when the ballot freezes. author_id and trust
 * are never set by the client; the server pins the author and RLS enforces it.
 */
export function ProposalForm({
  defaultOpens,
  dict,
}: {
  defaultOpens: string;
  dict: Dictionary;
}) {
  const [state, action, isPending] = useActionState<ProposalFormState, FormData>(
    createProposal,
    null,
  );
  const error = errorMessage(state, dict);

  return (
    <form action={action} className="flex flex-col gap-5">
      {error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="title">{dict.governance.fieldTitle}</Label>
        <Input
          id="title"
          name="title"
          required
          maxLength={160}
          placeholder={dict.governance.fieldTitlePlaceholder}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="kind">{dict.governance.fieldKind}</Label>
        <select
          id="kind"
          name="kind"
          defaultValue="minor"
          className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value="minor">{dict.governance.kinds.minor}</option>
          <option value="major">{dict.governance.kinds.major}</option>
          <option value="immutable">{dict.governance.kinds.immutable}</option>
        </select>
        <p className="text-xs text-muted-foreground">
          {dict.governance.fieldKindHint}
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="body">{dict.governance.fieldBody}</Label>
        <textarea
          id="body"
          name="body"
          rows={5}
          maxLength={4000}
          placeholder={dict.governance.fieldBodyPlaceholder}
          className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="opens_at">{dict.governance.fieldOpens}</Label>
          <Input
            id="opens_at"
            name="opens_at"
            type="datetime-local"
            required
            defaultValue={defaultOpens}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="closes_at">{dict.governance.fieldCloses}</Label>
          <Input
            id="closes_at"
            name="closes_at"
            type="datetime-local"
            required
          />
        </div>
      </div>

      <Button type="submit" disabled={isPending} className="self-start">
        {isPending ? dict.governance.submitting : dict.governance.submit}
      </Button>
    </form>
  );
}
