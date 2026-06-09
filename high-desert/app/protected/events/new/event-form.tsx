"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createEvent, type EventFormState } from "../actions";
import type { Dictionary } from "@/lib/i18n";

type Neighborhood = { id: string; name: string };

function errorMessage(state: EventFormState, dict: Dictionary): string | null {
  if (!state || !("error" in state)) return null;
  if (state.error === "title-required") return dict.events.titleRequired;
  if (state.error === "when-required") return dict.events.whenRequired;
  return dict.events.errorGeneric;
}

/**
 * Create-event form. Plain fields, no comment thread (P12). The date/time field
 * is entered in Redmond local time (the cohort's clock); on submit we convert it
 * to a precise instant (ISO) in a hidden field so the server stores a real
 * timestamptz. creator_id and trust are never touched here — the server pins the
 * creator and RLS enforces verified.
 */
export function EventForm({
  neighborhoods,
  defaultNeighborhoodId,
  dict,
}: {
  neighborhoods: Neighborhood[];
  defaultNeighborhoodId: string | null;
  dict: Dictionary;
}) {
  const [state, action, isPending] = useActionState<EventFormState, FormData>(
    createEvent,
    null,
  );
  const [localDt, setLocalDt] = useState("");
  const error = errorMessage(state, dict);

  // Browser-local → ISO instant. The cohort is in Redmond, so the device clock
  // and Redmond time line up; the value is read back and displayed in Redmond
  // time everywhere (see lib/events.ts).
  const iso = localDt ? new Date(localDt).toISOString() : "";

  return (
    <form action={action} className="flex flex-col gap-5">
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="title">{dict.events.fieldTitle}</Label>
        <Input
          id="title"
          name="title"
          required
          maxLength={140}
          placeholder={dict.events.fieldTitlePlaceholder}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="when">{dict.events.fieldWhen}</Label>
        <Input
          id="when"
          type="datetime-local"
          required
          value={localDt}
          onChange={(e) => setLocalDt(e.target.value)}
        />
        {/* Precise instant submitted to the server. */}
        <input type="hidden" name="starts_at" value={iso} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="neighborhood">{dict.events.fieldNeighborhood}</Label>
        <select
          id="neighborhood"
          name="neighborhood_id"
          defaultValue={defaultNeighborhoodId ?? "all"}
          className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value="all">{dict.events.allRedmond}</option>
          {neighborhoods.map((nb) => (
            <option key={nb.id} value={nb.id}>
              {nb.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="location">{dict.events.fieldWhere}</Label>
        <Input
          id="location"
          name="location"
          maxLength={200}
          placeholder={dict.events.fieldWherePlaceholder}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="capacity">{dict.events.fieldCapacity}</Label>
        <Input
          id="capacity"
          name="capacity"
          type="number"
          min={1}
          inputMode="numeric"
          placeholder={dict.events.fieldCapacityPlaceholder}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="body">{dict.events.fieldDetails}</Label>
        <textarea
          id="body"
          name="body"
          rows={4}
          maxLength={2000}
          placeholder={dict.events.fieldDetailsPlaceholder}
          className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>

      <Button type="submit" disabled={isPending} className="self-start">
        {isPending ? dict.events.submitting : dict.events.submit}
      </Button>
    </form>
  );
}
