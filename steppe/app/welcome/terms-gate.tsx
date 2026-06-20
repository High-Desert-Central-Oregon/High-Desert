"use client";

import { useActionState, useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { acceptCurrentDocuments, type ConsentState } from "./actions";
import type { Dictionary } from "@/lib/i18n";

/**
 * The read-and-confirm gate (CLAUDE.md invariant 10 — consequential actions are
 * deliberate; SPEC §05). The member must reach the end of the documents and
 * tick an explicit checkbox before "Agree and continue" enables.
 *
 * Built to degrade: the documents render server-side and sit in the normal page
 * flow (no nested scroll trap — kinder to mobile, keyboards, and slow phones).
 * Reaching the end is detected with an IntersectionObserver, a pure enhancement.
 * The checkbox is a native `required` input, so even with JavaScript disabled the
 * browser still blocks submission until the member agrees, and the agreement is
 * recorded by the server action against the database — never localStorage.
 */
export function TermsGate({
  dict,
  children,
}: {
  dict: Dictionary;
  children: ReactNode;
}) {
  const [state, formAction, isPending] = useActionState<ConsentState, FormData>(
    acceptCurrentDocuments,
    null,
  );
  const [reachedEnd, setReachedEnd] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Until hydration we leave the button enabled, so a no-JS browser can still
  // submit (the native required checkbox is the hard gate in that case).
  useEffect(() => setHydrated(true), []);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setReachedEnd(true);
      },
      { threshold: 0 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const blocked = hydrated && (!reachedEnd || !agreed);

  return (
    <form action={formAction}>
      <div className="rounded-lg border bg-card p-5 sm:p-6">{children}</div>

      {/* Marks the end of the documents; seeing it satisfies the read step. */}
      <div ref={sentinelRef} aria-hidden="true" className="h-px w-full" />

      <div className="sticky bottom-0 mt-4 border-t bg-background/95 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <input
              id="agree"
              name="agree"
              type="checkbox"
              required
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-1 size-4 shrink-0 rounded border-input accent-foreground"
            />
            <label htmlFor="agree" className="text-sm leading-snug">
              {dict.welcome.agreeLabel}
            </label>
          </div>

          <p className="text-xs text-muted-foreground" aria-live="polite">
            {reachedEnd ? dict.welcome.reachedEnd : dict.welcome.scrollHint}
          </p>

          {state?.error && (
            <p className="text-sm text-red-700 dark:text-red-400" role="alert">
              {dict.welcome.errorGeneric}
            </p>
          )}

          <Button
            type="submit"
            className="w-full sm:w-auto sm:self-end"
            disabled={blocked || isPending}
            aria-describedby={blocked ? "gate-help" : undefined}
          >
            {isPending ? dict.welcome.confirming : dict.welcome.confirm}
          </Button>

          {blocked && (
            <p id="gate-help" className="text-right text-xs text-muted-foreground">
              {dict.welcome.mustFinish}
            </p>
          )}
        </div>
      </div>
    </form>
  );
}
