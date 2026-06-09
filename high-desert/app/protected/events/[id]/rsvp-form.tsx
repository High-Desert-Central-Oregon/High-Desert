"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setRsvp, cancelRsvp, type RsvpState } from "../actions";
import type { RsvpStatus } from "@/lib/types/db";
import type { Dictionary } from "@/lib/i18n";

/**
 * RSVP control for an event. A verified member says going/maybe and (optionally)
 * what they're bringing — one row per member, so submitting again just updates
 * it. Withdrawing is a one-click sibling form. Light coordination only; there is
 * no comment field (P12).
 */
export function RsvpForm({
  eventId,
  initialStatus,
  initialBringing,
  dict,
}: {
  eventId: string;
  initialStatus: RsvpStatus | null;
  initialBringing: string | null;
  dict: Dictionary;
}) {
  const [saveState, save, saving] = useActionState<RsvpState, FormData>(
    setRsvp,
    null,
  );
  const [cancelState, cancel, cancelling] = useActionState<RsvpState, FormData>(
    cancelRsvp,
    null,
  );

  const hasRsvp = initialStatus !== null;
  const error =
    (saveState && "error" in saveState) || (cancelState && "error" in cancelState)
      ? dict.rsvp.errorGeneric
      : null;
  const saved = saveState && "ok" in saveState;

  return (
    <section className="flex flex-col gap-4 rounded-lg border bg-card p-4">
      <h2 className="font-medium">{dict.rsvp.formHeading}</h2>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {saved && !error && (
        <p role="status" className="text-sm text-green-700 dark:text-green-500">
          {dict.rsvp.saved}
        </p>
      )}

      <form action={save} className="flex flex-col gap-4">
        <input type="hidden" name="event_id" value={eventId} />

        <fieldset className="flex flex-col gap-2">
          <legend className="sr-only">{dict.rsvp.formHeading}</legend>
          <div className="flex flex-wrap gap-4">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="radio"
                name="status"
                value="going"
                defaultChecked={initialStatus !== "maybe"}
                className="accent-primary"
              />
              {dict.rsvp.statusGoing}
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="radio"
                name="status"
                value="maybe"
                defaultChecked={initialStatus === "maybe"}
                className="accent-primary"
              />
              {dict.rsvp.statusMaybe}
            </label>
          </div>
        </fieldset>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="bringing">{dict.rsvp.bringingLabel}</Label>
          <Input
            id="bringing"
            name="bringing"
            maxLength={120}
            defaultValue={initialBringing ?? ""}
            placeholder={dict.rsvp.bringingPlaceholder}
          />
        </div>

        <Button type="submit" disabled={saving} className="self-start">
          {saving
            ? dict.rsvp.saving
            : hasRsvp
              ? dict.rsvp.update
              : dict.rsvp.submit}
        </Button>
      </form>

      {hasRsvp && (
        <form action={cancel}>
          <input type="hidden" name="event_id" value={eventId} />
          <button
            type="submit"
            disabled={cancelling}
            className="text-sm text-muted-foreground underline-offset-2 hover:text-destructive hover:underline disabled:opacity-50"
          >
            {cancelling ? dict.rsvp.cancelling : dict.rsvp.cancel}
          </button>
        </form>
      )}
    </section>
  );
}
