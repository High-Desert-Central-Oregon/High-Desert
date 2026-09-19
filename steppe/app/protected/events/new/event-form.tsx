"use client";

import { DraftForm } from "@/components/draft-form";

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
 * Create-event form. Plain fields, no comment thread (P12). The date/time is
 * entered as a plain wall-clock value and submitted as-is; the server interprets
 * it as Redmond time (lib/time.ts) — never the browser's clock — so an organizer
 * in another timezone still schedules in Redmond time. creator_id and trust are
 * never touched here: the server pins the creator and RLS enforces verified.
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
  const error = errorMessage(state, dict);
  // Keep the draft when a form action returns a validation or save error.
  const [draft, setDraft] = useState({
    title: "",
    starts_at: "",
    neighborhood_id: defaultNeighborhoodId ?? "all",
    location: "",
    capacity: "",
    body: "",
  });

  return (
    <DraftForm action={action} className="flex flex-col gap-5">
      {error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="title">{dict.events.fieldTitle}</Label>
        <Input
          id="title"
          name="title"
          value={draft.title}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          required
          maxLength={140}
          placeholder={dict.events.fieldTitlePlaceholder}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="when">{dict.events.fieldWhen}</Label>
        {/* Submitted as a plain wall-clock string; the server reads it as
            Redmond time (lib/time.ts), independent of the browser's timezone. */}
        <Input
          id="when"
          name="starts_at"
          value={draft.starts_at}
          onChange={(e) => setDraft({ ...draft, starts_at: e.target.value })}
          type="datetime-local"
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="neighborhood">{dict.events.fieldNeighborhood}</Label>
        <select
          id="neighborhood"
          name="neighborhood_id"
          value={draft.neighborhood_id}
          onChange={(e) =>
            setDraft({ ...draft, neighborhood_id: e.target.value })
          }
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
          value={draft.location}
          onChange={(e) => setDraft({ ...draft, location: e.target.value })}
          maxLength={200}
          placeholder={dict.events.fieldWherePlaceholder}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="capacity">{dict.events.fieldCapacity}</Label>
        <Input
          id="capacity"
          name="capacity"
          value={draft.capacity}
          onChange={(e) => setDraft({ ...draft, capacity: e.target.value })}
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
          value={draft.body}
          onChange={(e) => setDraft({ ...draft, body: e.target.value })}
          rows={4}
          maxLength={2000}
          placeholder={dict.events.fieldDetailsPlaceholder}
          className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>

      <Button type="submit" disabled={isPending} className="self-start">
        {isPending ? dict.events.submitting : dict.events.submit}
      </Button>
    </DraftForm>
  );
}
