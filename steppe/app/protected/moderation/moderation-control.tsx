"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { moderateContent } from "./actions";
import type { ModeratableTarget } from "@/lib/moderation";
import type { Dictionary } from "@/lib/i18n";

/**
 * Moderator-only control to remove or restore a piece of content. A reason is
 * required (it's shown to the affected member and in the public transparency
 * log) and removal asks for confirmation, since taking content down is
 * consequential (invariant 10). The real authority check is in RLS; this is the
 * affordance.
 */
export function ModerationControl({
  targetType,
  targetId,
  mode,
  dict,
}: {
  targetType: ModeratableTarget;
  targetId: string;
  mode: "remove" | "restore";
  dict: Dictionary;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const submit = () => {
    setError(null);
    if (!reason.trim()) {
      setError(dict.moderation.reasonRequired);
      return;
    }
    if (mode === "remove" && !window.confirm(dict.moderation.removeConfirm)) {
      return;
    }
    start(async () => {
      const result = await moderateContent(targetType, targetId, mode, reason);
      if (result && "error" in result) setError(dict.moderation.error);
    });
  };

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-dashed p-4">
      <h2 className="text-sm font-medium">{dict.moderation.controlHeading}</h2>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="mod-reason" className="text-sm">
          {dict.moderation.reasonLabel}
        </label>
        <textarea
          id="mod-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          maxLength={500}
          placeholder={dict.moderation.reasonPlaceholder}
          className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
      <Button
        type="button"
        variant={mode === "remove" ? "destructive" : "outline"}
        size="sm"
        disabled={pending}
        onClick={submit}
        className="self-start"
      >
        {pending
          ? dict.moderation.working
          : mode === "remove"
            ? dict.moderation.removeSubmit
            : dict.moderation.restoreSubmit}
      </Button>
    </section>
  );
}
