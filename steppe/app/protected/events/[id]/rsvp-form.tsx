"use client";

import { useActionState, useState } from "react";
import { DraftForm } from "@/components/draft-form";
import { recordDiagnostic } from "@/lib/bug-reports/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setRsvp, cancelRsvp, type RsvpState } from "../actions";
import type { RsvpStatus } from "@/lib/types/db";
import type { Dictionary } from "@/lib/i18n";

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
  const [choice, setChoice] = useState(initialStatus ?? "");
  const [bringing, setBringing] = useState(initialBringing ?? "");
  const [notice, setNotice] = useState<"saved" | "cancelled" | null>(null);
  // One action queue means old save errors cannot mask a later cancellation.
  const [state, action, pending] = useActionState<RsvpState, FormData>(
    async (previous, fd) => {
      const cancelling = fd.get("operation") === "cancel";
      const result = await (cancelling ? cancelRsvp : setRsvp)(previous, fd);
      if (result && "ok" in result) {
        setNotice(cancelling ? "cancelled" : "saved");
        if (cancelling) {
          setChoice("");
          setBringing("");
        }
      } else setNotice(null);
      recordDiagnostic(result && "ok" in result ? "rsvp.saved" : "rsvp.failed");
      return result;
    },
    null,
  );
  const hasRsvp = initialStatus !== null;
  return (
    <section className="flex flex-col gap-4 rounded-lg border bg-card p-4">
      <h2 className="font-medium">{dict.rsvp.formHeading}</h2>
      {!hasRsvp && !notice && (
        <p className="text-sm text-muted-foreground">{dict.rsvp.notSaved}</p>
      )}
      {state && "error" in state && (
        <p role="alert" className="text-sm text-destructive">
          {dict.rsvp.errorGeneric}
        </p>
      )}
      {notice && (
        <p role="status" className="text-sm text-success">
          {dict.rsvp[notice]}
        </p>
      )}
      <DraftForm action={action} className="flex flex-col gap-4">
        <input type="hidden" name="event_id" value={eventId} />
        <fieldset disabled={pending} className="flex flex-col gap-2">
          <legend className="sr-only">{dict.rsvp.formHeading}</legend>
          <div className="flex flex-wrap gap-4">
            {(["going", "maybe"] as const).map((status) => (
              <label
                key={status}
                className="flex min-h-11 cursor-pointer items-center gap-2 text-sm"
              >
                <input
                  type="radio"
                  name="status"
                  value={status}
                  required
                  checked={choice === status}
                  onChange={() => {
                    setChoice(status);
                    setNotice(null);
                  }}
                  className="accent-primary"
                />
                {status === "going"
                  ? dict.rsvp.statusGoing
                  : dict.rsvp.statusMaybe}
              </label>
            ))}
          </div>
          <Label htmlFor="bringing">{dict.rsvp.bringingLabel}</Label>
          <Input
            id="bringing"
            name="bringing"
            maxLength={120}
            value={bringing}
            onChange={(e) => {
              setBringing(e.target.value);
              setNotice(null);
            }}
            placeholder={dict.rsvp.bringingPlaceholder}
          />
        </fieldset>
        <Button type="submit" disabled={pending} className="self-start">
          {pending
            ? dict.rsvp.saving
            : hasRsvp
              ? dict.rsvp.update
              : dict.rsvp.submit}
        </Button>
      </DraftForm>
      {hasRsvp && (
        <form action={action}>
          <input type="hidden" name="event_id" value={eventId} />
          <input type="hidden" name="operation" value="cancel" />
          <Button type="submit" variant="outline" disabled={pending}>
            {pending ? dict.rsvp.cancelling : dict.rsvp.cancel}
          </Button>
        </form>
      )}
    </section>
  );
}
