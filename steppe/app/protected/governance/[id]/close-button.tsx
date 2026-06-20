"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { recordProposalClose } from "../actions";
import type { Dictionary } from "@/lib/i18n";

/**
 * Moderator-only finalization, shown when a proposal's window has passed but it
 * hasn't been formally closed yet. Recording the close writes the official
 * aggregate result to the public, append-only audit log (invariant 5: a person
 * finalizes the consequence). RLS re-checks moderator authority server-side.
 */
export function CloseButton({
  proposalId,
  dict,
}: {
  proposalId: string;
  dict: Dictionary;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-dashed p-4">
      <p className="text-xs text-muted-foreground">{dict.governance.closeHint}</p>
      {error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        className="self-start"
        onClick={() => {
          setError(null);
          start(async () => {
            const result = await recordProposalClose(proposalId);
            if (result?.error) setError(dict.governance.closeError);
          });
        }}
      >
        {pending ? dict.governance.recording : dict.governance.recordClose}
      </Button>
    </div>
  );
}
