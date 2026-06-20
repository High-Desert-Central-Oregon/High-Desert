"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { resolveAppeal } from "./actions";
import type { Dictionary } from "@/lib/i18n";

/**
 * Moderator control to resolve an open appeal — uphold the removal or overturn
 * it (which restores the content). A reason is required and recorded. If the
 * viewer took the original action they don't see this (separation of duties); the
 * resolve_appeal() RPC enforces that regardless.
 */
export function AppealResolver({
  appealId,
  dict,
}: {
  appealId: string;
  dict: Dictionary;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const resolve = (uphold: boolean) => {
    setError(null);
    if (!reason.trim()) {
      setError(dict.moderation.reasonRequired);
      return;
    }
    start(async () => {
      const result = await resolveAppeal(appealId, uphold, reason);
      if (result?.error) setError(dict.moderation.resolveError);
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={`resolve-${appealId}`} className="text-sm font-medium">
        {dict.moderation.resolveReasonLabel}
      </label>
      <textarea
        id={`resolve-${appealId}`}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={2}
        maxLength={500}
        placeholder={dict.moderation.resolveReasonPlaceholder}
        className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      />
      {error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => resolve(true)}
        >
          {pending ? dict.moderation.resolving : dict.moderation.uphold}
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={pending}
          onClick={() => resolve(false)}
        >
          {pending ? dict.moderation.resolving : dict.moderation.overturn}
        </Button>
      </div>
    </div>
  );
}
