"use client";

import { DraftForm } from "@/components/draft-form";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { postCategoryMarker, EVENT_MARKER } from "@/lib/markers";
import { createPost, updatePost, type PostFormState } from "../actions";
import type { Dictionary } from "@/lib/i18n";

/**
 * The composer (bundle sheet :1026-1062, adapted to the app's page-form
 * pattern): the category picker leads — five writing chips (checkboxes,
 * default OFFER like the bundle :1685) plus the EVENT chip, which ROUTES to
 * the structured event form instead of writing an unstructured post
 * (spec §6.3). Chips are the bundle's compose-chip grammar: 10px marker
 * square + mono label, active = ink border on bone.
 */

/** Bundle picker order (:1044-1049) with EVENT third — a routing chip, not a
 *  checkbox (§6.3). */
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
  initial,
}: {
  neighborhoods: { id: string; name: string }[];
  dict: Dictionary;
  initial?: {
    id: string;
    title: string;
    body: string;
    tags: string[];
    category: string;
    neighborhood_id: string | null;
  };
}) {
  const [state, action, isPending] = useActionState<PostFormState, FormData>(
    initial ? updatePost.bind(null, initial.id) : createPost,
    null,
  );
  const error = errorMessage(state, dict);
  // React resets uncontrolled form fields when an action returns, including a
  // returned validation error. Keep the draft in memory until success navigates.
  const [draft, setDraft] = useState({
    title: initial?.title ?? "",
    body: initial?.body ?? "",
    tags: initial?.tags.length ? initial.tags : [initial?.category ?? "offer"],
    neighborhood: initial?.neighborhood_id ?? "",
  });

  const chipClass =
    "flex cursor-pointer items-center gap-[7px] border px-3 py-2 font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-foreground peer-checked:border-foreground peer-checked:bg-muted peer-focus-visible:ring-1 peer-focus-visible:ring-ring";

  return (
    <DraftForm action={action} className="flex flex-col gap-5">
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
          {CHIP_ORDER.filter((c) => !initial || c !== "event").map((c) =>
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
                  type="checkbox"
                  id={`cat-${c}`}
                  name="category"
                  value={c}
                  checked={draft.tags.includes(c)}
                  onChange={() =>
                    setDraft({
                      ...draft,
                      tags: draft.tags.includes(c)
                        ? draft.tags.filter((tag) => tag !== c)
                        : [...draft.tags, c],
                    })
                  }
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
        <p className="text-xs text-muted-foreground">
          {dict.exchange.tagsHint}
        </p>
        <dl className="text-sm text-muted-foreground">
          {(["need", "offer", "aid", "job", "goods"] as const)
            .filter((c) => draft.tags.includes(c))
            .map((c) => (
              <div key={c}>
                <dt className="font-medium inline">
                  {dict.exchange.cats[c]}:{" "}
                </dt>
                <dd className="inline">{dict.exchange.descriptions[c]}</dd>
              </div>
            ))}
        </dl>
        {!initial && (
          <p id="event-chip-hint" className="text-xs text-muted-foreground">
            {dict.exchange.eventChipHint}
          </p>
        )}
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="title">{dict.exchange.titleField}</Label>
        <Input
          id="title"
          name="title"
          value={draft.title}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          required
          maxLength={160}
          aria-describedby="title-count"
          placeholder={dict.exchange.titlePh}
        />
        <p id="title-count" className="text-xs text-muted-foreground">
          {draft.title.length} / 160 {dict.common.characters}
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="body">{dict.exchange.bodyField}</Label>
        <textarea
          id="body"
          name="body"
          value={draft.body}
          onChange={(e) => setDraft({ ...draft, body: e.target.value })}
          rows={5}
          required
          maxLength={4000}
          aria-describedby="body-count"
          placeholder={dict.exchange.bodyPh}
          className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
        <p id="body-count" className="text-xs text-muted-foreground">
          {draft.body.length} / 4000 {dict.common.characters}
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="neighborhood_id">{dict.exchange.hoodField}</Label>
        <select
          id="neighborhood_id"
          name="neighborhood_id"
          value={draft.neighborhood}
          onChange={(e) => setDraft({ ...draft, neighborhood: e.target.value })}
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

      <Button
        type="submit"
        disabled={isPending || draft.tags.length === 0}
        className="self-start"
      >
        {isPending
          ? dict.exchange.updating
          : initial
            ? dict.exchange.save
            : dict.exchange.post}
      </Button>
    </DraftForm>
  );
}
