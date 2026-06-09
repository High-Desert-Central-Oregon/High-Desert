"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { setNeighborhood, type NeighborhoodState } from "./actions";
import type { Dictionary } from "@/lib/i18n";

type Neighborhood = { id: string; name: string };

/**
 * Neighborhood picker. 35 Redmond neighborhoods as radio buttons (alphabetical,
 * two-column on wider screens) plus a "None of these fit" option. Submits via
 * server action; shows an inline confirmation rather than redirecting, so the
 * member can immediately change their mind if they mis-clicked.
 *
 * "None fits" posts value="none" → the action sets neighborhood_id to null.
 * The member is shown a follow-up confirmation; moderators see them in the
 * review queue (Step 5 Part 2).
 */
export function NeighborhoodForm({
  neighborhoods,
  currentId,
  dict,
}: {
  neighborhoods: Neighborhood[];
  currentId: string | null;
  dict: Dictionary;
}) {
  const [state, action, isPending] = useActionState<NeighborhoodState, FormData>(
    setNeighborhood,
    null,
  );

  // "None fits" path: show confirmation card + option to reconsider.
  if (state && "saved" in state && state.cleared) {
    return (
      <div className="flex flex-col gap-4 rounded-lg border bg-card p-6">
        <h2 className="font-semibold">{dict.neighborhoods.noneConfirmTitle}</h2>
        <p className="text-sm text-muted-foreground">
          {dict.neighborhoods.noneConfirmBody}
        </p>
        <div className="flex gap-4 text-sm">
          <Link
            href="/protected"
            className="text-primary underline-offset-2 hover:underline"
          >
            {dict.neighborhoods.backHome}
          </Link>
          {/* reload the page to get back to the form */}
          <a
            href="/protected/neighborhoods"
            className="text-muted-foreground underline-offset-2 hover:underline hover:text-foreground"
          >
            {dict.neighborhoods.legend} →
          </a>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-6">
      {/* Success banner (normal pick) */}
      {state && "saved" in state && !state.cleared && (
        <p role="status" className="text-sm text-green-700 dark:text-green-500">
          {dict.neighborhoods.saved}
        </p>
      )}
      {/* Error banner */}
      {state && "error" in state && (
        <p role="alert" className="text-sm text-destructive">
          {dict.neighborhoods.errorGeneric}
        </p>
      )}

      <fieldset>
        <legend className="mb-3 text-sm font-medium">
          {dict.neighborhoods.legend}
        </legend>

        {/* Two-column grid on sm+; single column on mobile */}
        <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
          {neighborhoods.map((nb) => (
            <label
              key={nb.id}
              className="flex cursor-pointer items-center gap-2.5 rounded px-2 py-1.5 hover:bg-muted"
            >
              <input
                type="radio"
                name="neighborhood_id"
                value={nb.id}
                defaultChecked={nb.id === currentId}
                className="accent-primary"
              />
              <span className="text-sm">{nb.name}</span>
            </label>
          ))}

          {/* "None of these fit" — full-width row, visually separated */}
          <label className="col-span-full mt-2 flex cursor-pointer items-start gap-2.5 rounded border border-dashed px-2 py-2 hover:bg-muted sm:mt-3">
            <input
              type="radio"
              name="neighborhood_id"
              value="none"
              defaultChecked={currentId === null}
              className="mt-0.5 accent-primary"
            />
            <span className="text-sm">
              <span className="font-medium">
                {dict.neighborhoods.noneOptionLabel}
              </span>
              <span className="ml-1 text-muted-foreground">
                — {dict.neighborhoods.noneOptionHint}
              </span>
            </span>
          </label>
        </div>
      </fieldset>

      <Button type="submit" disabled={isPending} className="self-start">
        {isPending ? dict.neighborhoods.saving : dict.neighborhoods.save}
      </Button>
    </form>
  );
}
