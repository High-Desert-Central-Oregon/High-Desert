"use client";

import { useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  updateDisplayName,
  setFieldVisibility,
  type ProfileState,
} from "../actions";
import type { Dictionary } from "@/lib/i18n";
import type { FieldVisibility } from "@/lib/types/db";

type AccountDict = Dictionary["account"];

type VisibilityFieldView = {
  field: string;
  label: string;
  /** Human-readable current content the toggle governs (e.g. neighborhood name), or null. */
  value: string | null;
  visibility: FieldVisibility;
};

/**
 * The You-surface profile editor (Y1). Two parts, both writing the member's own
 * row through pf_update (trust columns stay frozen by the DB trigger):
 *   • display_name — the always-public, member-chosen, non-legal handle.
 *   • per-field visibility — each hideable field is its OWN two-state control,
 *     default Hidden. "Reveal one at a time" (cDB); there is deliberately no
 *     bulk "make everything visible" (the dark pattern the promise is written
 *     against). State is announced programmatically (role=status), never by
 *     colour alone (invariant 9).
 */
export function ProfileForm({
  displayName,
  fields,
  dict,
}: {
  displayName: string;
  fields: VisibilityFieldView[];
  dict: Dictionary;
}) {
  const a = dict.account;
  return (
    <div className="flex flex-col gap-8">
      <NameEditor displayName={displayName} a={a} />

      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-semibold">{a.visibilityHeading}</h2>
          <p className="text-sm text-muted-foreground">{a.visibilityIntro}</p>
        </div>
        <ul className="flex flex-col divide-y border-y">
          {fields.map((f) => (
            <li key={f.field} className="py-4">
              <VisibilityControl field={f} a={a} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function NameEditor({
  displayName,
  a,
}: {
  displayName: string;
  a: AccountDict;
}) {
  const [state, action, pending] = useActionState<ProfileState, FormData>(
    updateDisplayName,
    null,
  );
  const error =
    state && "error" in state
      ? state.error === "name-required"
        ? a.nameRequired
        : state.error === "name-too-long"
          ? a.nameTooLong
          : a.profileSaveError
      : null;

  return (
    <form action={action} className="flex flex-col gap-2">
      <Label htmlFor="display_name">{a.nameLabel}</Label>
      <Input
        id="display_name"
        name="display_name"
        defaultValue={displayName}
        maxLength={80}
        required
        aria-describedby="name-help"
      />
      <p id="name-help" className="text-xs text-muted-foreground">
        {a.nameHelp}
      </p>
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={pending}>
          {a.nameSave}
        </Button>
        {state && "saved" in state && (
          <span role="status" className="text-xs text-muted-foreground">
            {a.nameSaved}
          </span>
        )}
        {error && (
          <span role="alert" className="text-xs text-accent">
            {error}
          </span>
        )}
      </div>
    </form>
  );
}

function VisibilityControl({
  field,
  a,
}: {
  field: VisibilityFieldView;
  a: AccountDict;
}) {
  const [state, action, pending] = useActionState<ProfileState, FormData>(
    setFieldVisibility,
    null,
  );
  // Controlled so the shown state can't drift from the server after a toggle.
  const [selected, setSelected] = useState<FieldVisibility>(field.visibility);

  // On a SETTLED error the write did not persist, so the chip must fall back to
  // the confirmed (server-read) value — never rest on the un-saved attempt (the
  // false-private mode). While pending we still show the optimistic pick for
  // immediate feedback; on success `selected` already equals what persisted.
  const failed = !pending && state !== null && "error" in state;
  const shown: FieldVisibility = failed ? field.visibility : selected;

  // Once an action SETTLES, snap `selected` back to the confirmed server value.
  // The error path never revalidates (so it never remounts), which would leave
  // `selected` holding the un-saved optimistic pick; success re-reads the new
  // value. Reconciling here means `selected`, `shown`, the chip, and the text
  // can never drift apart on a later render, and the radio's DOM state matches.
  useEffect(() => {
    if (state !== null && !pending) setSelected(field.visibility);
  }, [state, pending, field.visibility]);

  const options: { value: FieldVisibility; label: string }[] = [
    { value: "hidden", label: a.visHidden },
    { value: "members", label: a.visMembers },
  ];

  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="field" value={field.field} />
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium">{field.label}</span>
        <span className="text-xs text-muted-foreground">
          {field.value ?? a.fieldNeighborhoodNone}
        </span>
      </div>
      <fieldset disabled={pending}>
        <legend className="sr-only">{field.label}</legend>
        <div role="radiogroup" aria-label={field.label} className="flex gap-2">
          {options.map((o) => (
            <label
              key={o.value}
              // Highlight is driven by React `shown` (the SAME source as the
              // helper text below), NOT by the DOM radio's :checked pseudo — a
              // controlled radio's DOM checked can desync from React, which let
              // the highlight sit on the un-saved value while the text showed the
              // confirmed one. Deriving both from `shown` makes that impossible.
              className={`cursor-pointer rounded-md border px-3 py-1.5 text-sm has-[:focus-visible]:ring-1 has-[:focus-visible]:ring-ring ${
                shown === o.value ? "border-accent bg-accent/10" : ""
              }`}
            >
              <input
                type="radio"
                name="visibility"
                value={o.value}
                checked={shown === o.value}
                onChange={(e) => {
                  setSelected(o.value);
                  e.currentTarget.form?.requestSubmit();
                }}
                className="sr-only"
              />
              {o.label}
            </label>
          ))}
        </div>
      </fieldset>
      {failed ? (
        // Visible failure: the member must KNOW it didn't save (role=alert), and
        // the chip above has already reverted to the confirmed value.
        <p role="alert" className="text-xs text-accent">
          {a.profileSaveError}
        </p>
      ) : (
        <p role="status" className="text-xs text-muted-foreground">
          {shown === "members" ? a.visStateMembers : a.visStateHidden}
        </p>
      )}
    </form>
  );
}
