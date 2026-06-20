"use client";

import { useActionState, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createGroup,
  suggestCategory,
  type GroupFormState,
} from "../actions";
import type { Dictionary } from "@/lib/i18n";

type Category = { id: string; slug: string; name: string };
type Preset = "public_board" | "curated" | "private" | "advanced";

function errorMessage(state: GroupFormState, dict: Dictionary): string | null {
  if (!state || !("error" in state)) return null;
  if (state.error === "name-required" || state.error === "name-invalid")
    return dict.groups.nameRequired;
  if (state.error === "name-taken") return dict.groups.nameTaken;
  return dict.groups.errorGeneric;
}

const SELECT_CLASS =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

/**
 * Create-group form. A preset picker sets the two real axes (visibility ×
 * join_policy); "Advanced" reveals the raw axes for anyone who wants them — sugar
 * over state, not new state (Spec §1). Category is a select with an inline
 * "suggest a new one" that calls suggest_category and adds it immediately (open
 * taxonomy, §6). The server pins the creator as maintainer via create_group.
 */
export function CreateGroupForm({
  categories: initialCategories,
  dict,
}: {
  categories: Category[];
  dict: Dictionary;
}) {
  const [state, action, isPending] = useActionState<GroupFormState, FormData>(
    createGroup,
    null,
  );
  const error = errorMessage(state, dict);

  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [categoryId, setCategoryId] = useState<string>("");
  const [preset, setPreset] = useState<Preset>("public_board");
  const [newCategory, setNewCategory] = useState("");
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const [isSuggesting, startSuggest] = useTransition();

  const onSuggest = () => {
    const name = newCategory.trim();
    if (!name) return;
    setSuggestError(null);
    startSuggest(async () => {
      const result = await suggestCategory(name);
      if ("error" in result) {
        setSuggestError(dict.groups.suggestError);
        return;
      }
      setCategories((prev) =>
        prev.some((c) => c.id === result.id) ? prev : [...prev, result],
      );
      setCategoryId(result.id);
      setNewCategory("");
    });
  };

  const presets: { key: Preset; label: string; hint: string }[] = [
    { key: "public_board", label: dict.groups.presetPublicBoard, hint: dict.groups.presetPublicBoardHint },
    { key: "curated", label: dict.groups.presetCurated, hint: dict.groups.presetCuratedHint },
    { key: "private", label: dict.groups.presetPrivate, hint: dict.groups.presetPrivateHint },
    { key: "advanced", label: dict.groups.presetAdvanced, hint: dict.groups.presetAdvancedHint },
  ];

  return (
    <form action={action} className="flex flex-col gap-5">
      {error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">{dict.groups.fieldName}</Label>
        <Input
          id="name"
          name="name"
          required
          maxLength={120}
          placeholder={dict.groups.fieldNamePlaceholder}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="description">{dict.groups.fieldDescription}</Label>
        <textarea
          id="description"
          name="description"
          rows={3}
          maxLength={2000}
          placeholder={dict.groups.fieldDescriptionPlaceholder}
          className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>

      {/* Category — select one, or suggest a new one inline. */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="category_id">{dict.groups.fieldCategory}</Label>
        <select
          id="category_id"
          name="category_id"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className={SELECT_CLASS}
        >
          <option value="">{dict.groups.noCategory}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <div className="mt-1 flex flex-col gap-1">
          <div className="flex gap-2">
            <Input
              aria-label={dict.groups.suggestLabel}
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              maxLength={60}
              placeholder={dict.groups.suggestPlaceholder}
            />
            <Button
              type="button"
              variant="outline"
              onClick={onSuggest}
              disabled={isSuggesting || newCategory.trim().length === 0}
            >
              {isSuggesting ? dict.groups.suggesting : dict.groups.suggestAdd}
            </Button>
          </div>
          {suggestError && (
            <span role="alert" className="text-xs text-red-700 dark:text-red-400">
              {suggestError}
            </span>
          )}
        </div>
      </div>

      {/* Preset picker — sets visibility × join_policy. */}
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">{dict.groups.fieldPreset}</legend>
        <div className="flex flex-col gap-2">
          {presets.map((p) => (
            <label
              key={p.key}
              className="flex items-start gap-2.5 rounded-md border bg-card p-3 text-sm has-[:checked]:border-ring"
            >
              <input
                type="radio"
                name="preset"
                value={p.key}
                checked={preset === p.key}
                onChange={() => setPreset(p.key)}
                className="mt-0.5"
              />
              <span className="flex flex-col">
                <span className="font-medium">{p.label}</span>
                <span className="text-muted-foreground">{p.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* Advanced: the raw axes, revealed only when chosen. */}
      {preset === "advanced" && (
        <div className="flex flex-col gap-4 rounded-md border border-dashed p-4 sm:flex-row">
          <div className="flex flex-1 flex-col gap-1.5">
            <Label htmlFor="visibility">{dict.groups.fieldVisibility}</Label>
            <select id="visibility" name="visibility" className={SELECT_CLASS} defaultValue="public">
              <option value="public">{dict.groups.visibilityPublic}</option>
              <option value="members_only">{dict.groups.visibilityMembersOnly}</option>
            </select>
          </div>
          <div className="flex flex-1 flex-col gap-1.5">
            <Label htmlFor="join_policy">{dict.groups.fieldJoinPolicy}</Label>
            <select id="join_policy" name="join_policy" className={SELECT_CLASS} defaultValue="open">
              <option value="open">{dict.groups.joinOpen}</option>
              <option value="request">{dict.groups.joinRequest}</option>
              <option value="locked">{dict.groups.joinLocked}</option>
            </select>
          </div>
        </div>
      )}

      <Button type="submit" disabled={isPending} className="self-start">
        {isPending ? dict.groups.creating : dict.groups.createSubmit}
      </Button>
    </form>
  );
}
