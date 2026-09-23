"use client";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { deletePost, type PostFormState } from "../actions";
import type { Dictionary } from "@/lib/i18n";
export function DeletePost({ id, dict }: { id: string; dict: Dictionary }) {
  const [confirming, setConfirming] = useState(false);
  const [state, action, pending] = useActionState<PostFormState, FormData>(
    deletePost.bind(null, id),
    null,
  );
  if (!confirming)
    return (
      <Button variant="outline" onClick={() => setConfirming(true)}>
        {dict.exchange.delete}
      </Button>
    );
  return (
    <form action={action} className="flex flex-col gap-3 rounded border p-4">
      <p>{dict.exchange.deleteConfirm}</p>
      <input type="hidden" name="confirm" value="delete" />
      {state && (
        <p role="alert" className="text-destructive">
          {dict.exchange.errorGeneric}
        </p>
      )}
      <div className="flex gap-3">
        <Button type="submit" variant="destructive" disabled={pending}>
          {dict.exchange.delete}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() => setConfirming(false)}
        >
          {dict.exchange.keep}
        </Button>
      </div>
    </form>
  );
}
