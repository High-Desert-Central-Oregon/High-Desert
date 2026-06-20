"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { setNeighborhood, type NeighborhoodState } from "./actions";
import type { Dictionary } from "@/lib/i18n";

type Neighborhood = { id: string; name: string };

const NONE = "none";

/**
 * Neighborhood picker. 35 Redmond neighborhoods as radio buttons (alphabetical,
 * two-column on wider screens) plus a "None of these fit" option that reveals an
 * optional "where do you live?" note. Submits via server action; shows an inline
 * confirmation rather than redirecting, so the member can immediately change
 * their mind if they mis-clicked.
 *
 * Picking a real neighborhood sets profiles.neighborhood_id (and a DB trigger
 * auto-resolves any open help request). "None fits" leaves it null and opens a
 * neighborhood-help request a moderator follows up on (Step 5 Part 1).
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
  // Track the selection so the note field can appear only for "none fits".
  const [selected, setSelected] = useState<string>(currentId ?? NONE);

  // "None fits" path: show confirmation card + a way back to the form.
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
          <a
            href="/protected/neighborhoods"
            className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
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
        <p role="status" className="text-sm text-success">
          {dict.neighborhoods.saved}
        </p>
      )}
      {/* Error banner */}
      {state && "error" in state && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
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
                checked={selected === nb.id}
                onChange={() => setSelected(nb.id)}
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
              value={NONE}
              checked={selected === NONE}
              onChange={() => setSelected(NONE)}
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

      {/* Optional note, only when "none fits" is chosen */}
      {selected === NONE && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="note" className="text-sm font-medium">
            {dict.neighborhoods.noneNoteLabel}
          </label>
          <textarea
            id="note"
            name="note"
            rows={2}
            maxLength={300}
            placeholder={dict.neighborhoods.noneNotePlaceholder}
            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
      )}

      <Button type="submit" disabled={isPending} className="self-start">
        {isPending ? dict.neighborhoods.saving : dict.neighborhoods.save}
      </Button>
    </form>
  );
}
