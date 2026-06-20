"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { castVote, type VoteState } from "../actions";
import type { VoteChoice } from "@/lib/types/db";
import type { Dictionary } from "@/lib/i18n";

const CHOICES: VoteChoice[] = ["yes", "no", "abstain"];

/**
 * Secret ballot. The member picks yes / no / abstain and may change it as often
 * as they like until the proposal closes (each submit overwrites the one row).
 * No tally or partial result is ever shown here while voting is open — that's
 * the secret-until-close invariant, and it's enforced in the database, not by
 * hiding a number in the UI. The weight is set server-side from tenure; the form
 * sends only a choice.
 */
export function VoteForm({
  proposalId,
  initialChoice,
  dict,
}: {
  proposalId: string;
  initialChoice: VoteChoice | null;
  dict: Dictionary;
}) {
  const [state, action, isPending] = useActionState<VoteState, FormData>(
    castVote,
    null,
  );
  const error = state && "error" in state ? dict.governance.voteError : null;
  const saved = state && "ok" in state;
  const hasVoted = initialChoice !== null;

  return (
    <section className="flex flex-col gap-4 rounded-lg border bg-card p-4">
      <div className="flex flex-col gap-1">
        <h2 className="font-medium">{dict.governance.voteHeading}</h2>
        <p className="text-sm text-muted-foreground">
          {dict.governance.voteSecrecyNote}
        </p>
      </div>

      {error && (
        <p
          id="vote-error"
          role="alert"
          className="text-sm text-red-700 dark:text-red-400"
        >
          {error}
        </p>
      )}
      {saved && !error && (
        <p role="status" className="text-sm text-success">
          {dict.governance.voteSaved}
        </p>
      )}

      <form action={action} className="flex flex-col gap-4">
        <input type="hidden" name="proposal_id" value={proposalId} />

        <fieldset
          className="flex flex-col gap-2"
          aria-describedby={error ? "vote-error" : undefined}
        >
          <legend className="sr-only">{dict.governance.voteHeading}</legend>
          {CHOICES.map((c) => (
            <label
              key={c}
              className="flex cursor-pointer items-center gap-2.5 rounded px-2 py-1.5 text-sm hover:bg-muted"
            >
              <input
                type="radio"
                name="choice"
                value={c}
                required
                defaultChecked={initialChoice === c}
                className="accent-primary"
              />
              {dict.governance.choices[c]}
            </label>
          ))}
        </fieldset>

        <Button type="submit" disabled={isPending} className="self-start">
          {isPending
            ? dict.governance.voteSubmitting
            : hasVoted
              ? dict.governance.voteChange
              : dict.governance.voteSubmit}
        </Button>
      </form>
    </section>
  );
}
