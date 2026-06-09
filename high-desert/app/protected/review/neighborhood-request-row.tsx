"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { resolveNeighborhoodRequest } from "../neighborhoods/actions";
import type { Dictionary } from "@/lib/i18n";

/**
 * One open neighborhood-help request in the moderator queue. Shows who asked,
 * the optional note about where they live, and when they joined. "Mark resolved"
 * is the human follow-up (invariant 5): a person has reached out and placed them,
 * so the moderator closes the request. After resolving, the row drops off.
 */
export function NeighborhoodRequestRow({
  id,
  memberName,
  note,
  memberSince,
  dict,
}: {
  id: string;
  memberName: string;
  note: string | null;
  memberSince: string;
  dict: Dictionary;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isResolving, startResolve] = useTransition();

  const resolve = () => {
    setError(null);
    startResolve(async () => {
      const result = await resolveNeighborhoodRequest(id);
      if (result?.error) setError(dict.review.resolveError);
    });
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 text-sm">
        <p className="font-medium">{memberName}</p>
        <p className="mt-0.5 text-muted-foreground">{memberSince}</p>
        {note ? (
          <p className="mt-2">
            <span className="text-muted-foreground">
              {dict.review.requestNote}{" "}
            </span>
            {note}
          </p>
        ) : (
          <p className="mt-2 text-muted-foreground">{dict.review.requestNoNote}</p>
        )}
        {error && (
          <p className="mt-1 text-destructive" role="alert">
            {error}
          </p>
        )}
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={resolve}
        disabled={isResolving}
        className="shrink-0"
      >
        {isResolving ? dict.review.resolving : dict.review.markResolved}
      </Button>
    </div>
  );
}
