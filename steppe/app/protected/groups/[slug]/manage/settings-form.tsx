"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateGroupSettings, type SettingsState } from "./actions";
import type { Dictionary } from "@/lib/i18n";
import type {
  Category,
  GroupVisibility,
  GroupJoinPolicy,
} from "@/lib/types/db";

const SELECT_CLASS =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

function message(state: SettingsState, dict: Dictionary): {
  text: string;
  ok: boolean;
} | null {
  if (!state) return null;
  if ("ok" in state) return { text: dict.groups.settingsSaved, ok: true };
  if (state.error === "name-required")
    return { text: dict.groups.nameRequired, ok: false };
  if (state.error === "last-maintainer")
    return { text: dict.groups.lastMaintainerError, ok: false };
  return { text: dict.groups.settingsError, ok: false };
}

/** Edit a group's settings → update_group_settings (maintainer-only; G9). */
export function SettingsForm({
  groupId,
  slug,
  name,
  description,
  categoryId,
  visibility,
  joinPolicy,
  categories,
  dict,
}: {
  groupId: string;
  slug: string;
  name: string;
  description: string | null;
  categoryId: string | null;
  visibility: GroupVisibility;
  joinPolicy: GroupJoinPolicy;
  categories: Pick<Category, "id" | "name">[];
  dict: Dictionary;
}) {
  const [state, action, isPending] = useActionState<SettingsState, FormData>(
    updateGroupSettings,
    null,
  );
  const msg = message(state, dict);

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="group_id" value={groupId} />
      <input type="hidden" name="slug" value={slug} />

      {msg && (
        <p
          role="alert"
          className={
            msg.ok
              ? "text-sm text-[hsl(var(--success))]"
              : "text-sm text-red-700 dark:text-red-400"
          }
        >
          {msg.text}
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">{dict.groups.fieldName}</Label>
        <Input id="name" name="name" required maxLength={120} defaultValue={name} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="description">{dict.groups.fieldDescription}</Label>
        <textarea
          id="description"
          name="description"
          rows={3}
          maxLength={2000}
          defaultValue={description ?? ""}
          className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="category_id">{dict.groups.fieldCategory}</Label>
        <select
          id="category_id"
          name="category_id"
          defaultValue={categoryId ?? ""}
          className={SELECT_CLASS}
        >
          <option value="">{dict.groups.noCategory}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="visibility">{dict.groups.fieldVisibility}</Label>
          <select
            id="visibility"
            name="visibility"
            defaultValue={visibility}
            className={SELECT_CLASS}
          >
            <option value="public">{dict.groups.visibilityPublic}</option>
            <option value="members_only">{dict.groups.visibilityMembersOnly}</option>
          </select>
        </div>
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="join_policy">{dict.groups.fieldJoinPolicy}</Label>
          <select
            id="join_policy"
            name="join_policy"
            defaultValue={joinPolicy}
            className={SELECT_CLASS}
          >
            <option value="open">{dict.groups.joinOpen}</option>
            <option value="request">{dict.groups.joinRequest}</option>
            <option value="locked">{dict.groups.joinLocked}</option>
          </select>
        </div>
      </div>

      <Button type="submit" disabled={isPending} className="self-start">
        {isPending ? dict.groups.saving : dict.groups.saveSettings}
      </Button>
    </form>
  );
}
