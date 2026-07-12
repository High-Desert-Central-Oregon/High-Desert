"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { postCategoryMarker, EVENT_MARKER } from "@/lib/markers";
import { createPost, type PostFormState } from "../actions";
import type { Dictionary } from "@/lib/i18n";

/**
 * The composer (bundle sheet :1026-1062, adapted to the app's page-form
 * pattern): the category picker leads — five writing chips (radio inputs,
 * default OFFER like the bundle :1685) plus the EVENT chip, which ROUTES to
 * the structured event form instead of writing an unstructured post
 * (spec §6.3). Chips are the bundle's compose-chip grammar: 10px marker
 * square + mono label, active = ink border on bone.
 */

/** Bundle picker order (:1044-1049) with EVENT third — a routing chip, not a
 *  radio (§6.3). */
const CHIP_ORDER = ["need", "offer", "event", "aid", "job", "goods"] as const;

function errorMessage(state: PostFormState, dict: Dictionary): string | null {
  if (!state || !("error" in state)) return null;
  if (state.error === "title-required") return dict.exchange.titleRequired;
  if (state.error === "body-required") return dict.exchange.bodyRequired;
  return dict.exchange.errorGeneric;
}

export function PostForm({
  neighborhoods,
  dict,
}: {
  neighborhoods: { id: string; name: string }[];
  dict: Dictionary;
}) {
  const [state, action, isPending] = useActionState<PostFormState, FormData>(
    createPost,
    null,
  );
  const error = errorMessage(state, dict);

  const chipClass =
    "flex cursor-pointer items-center gap-[7px] border px-3 py-2 font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-foreground peer-checked:border-foreground peer-checked:bg-muted peer-focus-visible:ring-1 peer-focus-visible:ring-ring";

  return (
    <form action={action} className="flex flex-col gap-5">
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <fieldset className="flex flex-col gap-2">
        <legend className="pb-1 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          {dict.exchange.categoryField}
        </legend>
        <div className="flex flex-wrap gap-2">
          {CHIP_ORDER.map((c) =>
            c === "event" ? (
              /* EVENT routes to the structured form — never an unstructured
                 post (§6.3). A link, not a radio; the hint below explains. */
              <Link
                key={c}
                href="/protected/events/new"
                aria-describedby="event-chip-hint"
                className="flex items-center gap-[7px] border px-3 py-2 font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <span
                  aria-hidden="true"
                  className="inline-block size-[10px] rounded-marker"
                  style={{ background: EVENT_MARKER }}
                />
                {dict.exchange.cats.event}
              </Link>
            ) : (
              <span key={c} className="relative">
                <input
                  type="radio"
                  id={`cat-${c}`}
                  name="category"
                  value={c}
                  defaultChecked={c === "offer"}
                  className="peer sr-only"
                />
                <label htmlFor={`cat-${c}`} className={chipClass}>
                  <span
                    aria-hidden="true"
                    className="inline-block size-[10px] rounded-marker"
                    style={{ background: postCategoryMarker(c) }}
                  />
                  {dict.exchange.cats[c]}
                </label>
              </span>
            ),
          )}
        </div>
        <p id="event-chip-hint" className="text-xs text-muted-foreground">
          {dict.exchange.eventChipHint}
        </p>
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="title">{dict.exchange.titleField}</Label>
        <Input
          id="title"
          name="title"
          required
          maxLength={160}
          placeholder={dict.exchange.titlePh}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="body">{dict.exchange.bodyField}</Label>
        <textarea
          id="body"
          name="body"
          rows={5}
          required
          maxLength={4000}
          placeholder={dict.exchange.bodyPh}
          className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="neighborhood_id">{dict.exchange.hoodField}</Label>
        <select
          id="neighborhood_id"
          name="neighborhood_id"
          defaultValue=""
          className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring sm:w-72"
        >
          <option value="">{dict.events.allRedmond}</option>
          {neighborhoods.map((n) => (
            <option key={n.id} value={n.id}>
              {n.name}
            </option>
          ))}
        </select>
      </div>

      <Button type="submit" disabled={isPending} className="self-start">
        {isPending ? dict.exchange.updating : dict.exchange.post}
      </Button>
    </form>
  );
}
