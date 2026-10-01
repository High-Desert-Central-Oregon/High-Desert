"use client";

import {
  startTransition,
  useActionState,
  useEffect,
  useId,
  useState,
} from "react";
import Link from "next/link";
import mapData from "../../../public/maps/redmond-2019/map.json";
import { NeighborhoodMap } from "./neighborhood-map";
import { Button } from "@/components/ui/button";
import { setNeighborhood, type NeighborhoodState } from "./actions";
import { subdivisionCatalog } from "@/lib/subdivision-outlines";
import { t, type Dictionary } from "@/lib/i18n";

type Neighborhood = { id: string; name: string };

const NONE = "none";
const countyAliases = Object.fromEntries(
  subdivisionCatalog.neighborhoods.map((row) => [
    row.name,
    row.platNames.join(" "),
  ]),
);

/**
 * Neighborhood picker. Redmond neighborhoods as radio buttons (alphabetical,
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
  const [state, action, isPending] = useActionState<
    NeighborhoodState,
    FormData
  >(setNeighborhood, null);
  const [view, setView] = useState<"map" | "list">("map");
  const [filter, setFilter] = useState("");
  const chooserId = useId();
  const filterId = useId();
  const aliases: Record<string, string> = mapData.aliases;
  const matches = (name: string) =>
    `${name} ${aliases[name] ?? ""} ${countyAliases[name] ?? ""}`
      .toLocaleLowerCase()
      .includes(filter.trim().toLocaleLowerCase());
  // Track the selection so the note field can appear only for "none fits".
  const [selected, setSelected] = useState<string>(currentId ?? NONE);

  // On a SETTLED error the write did not persist (incl. the read-back's
  // "not-persisted"), so the selection must fall back to the committed value —
  // never rest on the un-saved pick. Mirrors the visibility control's
  // revert-on-error (profile-form.tsx); the error banner below is the role=alert.
  useEffect(() => {
    if (state && "error" in state) setSelected(currentId ?? NONE);
  }, [state, currentId]);

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
    <form
      action={action}
      onSubmit={(event) => {
        // Dispatch explicitly so React doesn't reset the radios to their initial
        // defaults after saving. Keep action for submission before hydration.
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(() => action(formData));
      }}
      className="flex flex-col gap-6"
    >
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

      <div
        role="group"
        aria-label={dict.neighborhoods.pickerView}
        className="flex gap-2"
      >
        {(["map", "list"] as const).map((value) => (
          <Button
            type="button"
            key={value}
            aria-pressed={view === value}
            variant={view === value ? "default" : "outline"}
            className="min-h-11"
            onClick={() => setView(value)}
          >
            {dict.neighborhoods[value === "map" ? "mapOption" : "listOption"]}
          </Button>
        ))}
      </div>
      {view === "map" && (
        <NeighborhoodMap
          dict={dict}
          names={neighborhoods.map((nb) => nb.name)}
          selectedName={neighborhoods.find((nb) => nb.id === selected)?.name}
          onChooseName={(name) => {
            const row = neighborhoods.find((nb) => nb.name === name);
            if (row) setSelected(row.id);
          }}
        />
      )}
      <div
        hidden={view !== "map"}
        className={view === "map" ? "space-y-2" : "hidden"}
      >
        <label htmlFor={chooserId} className="text-sm font-medium">
          {dict.neighborhoods.legend}
        </label>
        <select
          id={chooserId}
          name="neighborhood_id"
          value={selected}
          disabled={view !== "map"}
          onChange={(event) => setSelected(event.target.value)}
          className="min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          {neighborhoods.map((nb) => (
            <option key={nb.id} value={nb.id}>
              {nb.name}
            </option>
          ))}
          <option value={NONE}>{dict.neighborhoods.noneOptionLabel}</option>
        </select>
      </div>
      <fieldset
        hidden={view !== "list"}
        disabled={view !== "list"}
        className={view === "list" ? "space-y-3" : "hidden"}
      >
        <legend className="mb-3 text-sm font-medium">
          {dict.neighborhoods.legend}
        </legend>
        <div className="space-y-1">
          <label htmlFor={filterId} className="text-sm">
            {dict.neighborhoods.filterLabel}
          </label>
          <input
            id={filterId}
            type="search"
            maxLength={100}
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            className="min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
          />
          <p role="status" className="text-sm text-muted-foreground">
            {t(dict.neighborhoods.filterCount, {
              count: String(
                neighborhoods.filter((nb) => matches(nb.name)).length,
              ),
              total: String(neighborhoods.length),
            })}
          </p>
        </div>
        {/* Two-column grid on sm+; single column on mobile */}
        <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
          {neighborhoods.map((nb) => (
            <label
              key={nb.id}
              className={`${matches(nb.name) ? "flex" : "hidden"} min-h-11 cursor-pointer items-center gap-2.5 rounded px-2 py-1.5 hover:bg-muted`}
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
                · {dict.neighborhoods.noneOptionHint}
              </span>
            </span>
          </label>
        </div>
      </fieldset>

      <p role="status" className="text-sm font-medium">
        {t(dict.neighborhoods.selectedChoice, {
          name:
            neighborhoods.find((nb) => nb.id === selected)?.name ??
            dict.neighborhoods.noneOptionLabel,
        })}
      </p>
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
