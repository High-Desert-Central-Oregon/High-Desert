"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { createEvidenceSignedUrl, decideVerification } from "./actions";
import type { Dictionary } from "@/lib/i18n";

/**
 * One pending verification in the reviewer queue. A moderator can open the
 * evidence (a fresh, short-lived signed URL minted on click) and then approve or
 * reject. Rejecting asks for confirmation, since denying residency is
 * consequential (invariant 10). After a decision the server revalidates the
 * queue and this row drops off.
 */
export function ReviewRow({
  id,
  applicantName,
  methodLabel,
  hasEvidence,
  submittedAt,
  dict,
}: {
  id: string;
  applicantName: string;
  methodLabel: string;
  hasEvidence: boolean;
  submittedAt: string;
  dict: Dictionary;
}) {
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const [isDeciding, startDecision] = useTransition();

  const viewEvidence = async () => {
    setError(null);
    setOpening(true);
    const result = await createEvidenceSignedUrl(id);
    setOpening(false);
    if ("url" in result) {
      window.open(result.url, "_blank", "noopener,noreferrer");
    } else {
      setError(dict.review.evidenceError);
    }
  };

  const decide = (approve: boolean) => {
    if (!approve && !window.confirm(dict.review.confirmReject)) return;
    setError(null);
    startDecision(async () => {
      const result = await decideVerification(id, approve);
      if (result?.error) setError(dict.review.decideError);
    });
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="text-sm">
        <p className="font-medium">{applicantName}</p>
        <p className="text-muted-foreground">
          {methodLabel} · {submittedAt}
        </p>
        {error && (
          <p className="mt-1 text-destructive" role="alert">
            {error}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {hasEvidence ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={viewEvidence}
            disabled={opening}
          >
            {opening ? dict.review.opening : dict.review.viewEvidence}
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">
            {dict.review.noEvidence}
          </span>
        )}

        <Button
          type="button"
          size="sm"
          onClick={() => decide(true)}
          disabled={isDeciding}
        >
          {isDeciding ? dict.review.deciding : dict.review.approve}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="destructive"
          onClick={() => decide(false)}
          disabled={isDeciding}
        >
          {dict.review.reject}
        </Button>
      </div>
    </div>
  );
}
