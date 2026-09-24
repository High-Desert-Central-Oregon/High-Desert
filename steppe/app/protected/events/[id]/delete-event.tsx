"use client";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { deleteEvent, type EventFormState } from "../actions";
import type { Dictionary } from "@/lib/i18n";
export function DeleteEvent({ id, dict }: { id: string; dict: Dictionary }) {
  const [confirming, setConfirming] = useState(false);
  const [state, action, pending] = useActionState<EventFormState, FormData>(
    deleteEvent.bind(null, id),
    null,
  );
  if (!confirming)
    return (
      <Button variant="outline" onClick={() => setConfirming(true)}>
        {dict.events.delete}
      </Button>
    );
  return (
    <form action={action} className="flex flex-col gap-3 rounded border p-4">
      <p>{dict.events.deleteConfirm}</p>
      <p className="text-sm text-muted-foreground">
        {dict.events.calendarNotice}
      </p>
      <input type="hidden" name="confirm" value="delete" />
      {state && (
        <p role="alert" className="text-destructive">
          {dict.events.deleteError}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" variant="destructive" disabled={pending}>
          {dict.events.delete}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() => setConfirming(false)}
        >
          {dict.events.keep}
        </Button>
      </div>
    </form>
  );
}
