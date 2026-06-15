"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/auth";
import { slugify } from "@/lib/groups";
import type { GroupVisibility, GroupJoinPolicy } from "@/lib/types/db";

export type JoinState = { ok: true } | { error: string } | null;
export type GroupFormState = { error: string } | null;
export type SuggestCategoryResult =
  | { id: string; slug: string; name: string }
  | { error: string };
export type ManageState = { ok: true } | { error: string } | null;

const PRESETS: Record<string, { visibility: GroupVisibility; join_policy: GroupJoinPolicy }> = {
  public_board: { visibility: "public", join_policy: "open" },
  curated: { visibility: "public", join_policy: "request" },
  private: { visibility: "members_only", join_policy: "locked" },
};

/**
 * Join (or request to join) a group. The 1a `join_group` RPC is the gate: it sets
 * status from the group's join_policy (open→active, request→pending,
 * locked→rejected) — the client never sets status (G10). Verified-only, enforced
 * by the RPC; the check here is just a friendlier error.
 */
export async function joinGroup(
  _prev: JoinState,
  formData: FormData,
): Promise<JoinState> {
  const profile = await getMyProfile();
  if (!profile) redirect("/auth/login");
  if (!profile.verified) return { error: "forbidden" };

  const groupId = String(formData.get("group_id") ?? "").trim();
  if (!groupId) return { error: "bad-group" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("join_group", { p_group: groupId });
  if (error) return { error: "join-failed" };

  revalidatePath("/protected/groups");
  return { ok: true };
}

/**
 * Create a group. `create_group` makes the creator the first active maintainer
 * and sets visibility/join_policy from the chosen preset (or the advanced axes).
 * Verified-only (RPC-enforced). The slug is derived from the name to match the
 * DB's own normalization; on a slug collision we ask for a different name.
 */
export async function createGroup(
  _prev: GroupFormState,
  formData: FormData,
): Promise<GroupFormState> {
  const profile = await getMyProfile();
  if (!profile) redirect("/auth/login");
  if (!profile.verified) return { error: "forbidden" };

  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const categoryRaw = String(formData.get("category_id") ?? "").trim();
  const presetKey = String(formData.get("preset") ?? "").trim();

  if (!name) return { error: "name-required" };
  const slug = slugify(name);
  if (!slug) return { error: "name-invalid" };

  // Preset sets the two axes; "advanced" sends the raw axes instead.
  let visibility: GroupVisibility;
  let joinPolicy: GroupJoinPolicy;
  if (presetKey === "advanced") {
    const v = String(formData.get("visibility") ?? "").trim();
    const j = String(formData.get("join_policy") ?? "").trim();
    if (v !== "public" && v !== "members_only") return { error: "bad-visibility" };
    if (j !== "open" && j !== "request" && j !== "locked") return { error: "bad-join" };
    visibility = v;
    joinPolicy = j;
  } else {
    const preset = PRESETS[presetKey];
    if (!preset) return { error: "bad-preset" };
    visibility = preset.visibility;
    joinPolicy = preset.join_policy;
  }

  const categoryId = categoryRaw.length > 0 ? categoryRaw : null;

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_group", {
    p_name: name,
    p_slug: slug,
    p_description: description.length > 0 ? description : null,
    p_category_id: categoryId,
    p_visibility: visibility,
    p_join_policy: joinPolicy,
  });

  if (error) {
    // 23505 = unique_violation on the slug.
    if (error.code === "23505") return { error: "name-taken" };
    return { error: "create-failed" };
  }

  revalidatePath("/protected/groups");
  redirect(`/protected/groups/${slug}`);
}

/**
 * Suggest a new category (Spec §6 — open taxonomy, any verified member). Dedupes
 * on slug in the RPC, so a duplicate just returns the existing row. Returns the
 * category so the create form can add and select it inline.
 */
export async function suggestCategory(
  name: string,
): Promise<SuggestCategoryResult> {
  const profile = await getMyProfile();
  if (!profile) redirect("/auth/login");
  if (!profile.verified) return { error: "forbidden" };

  const trimmed = name.trim();
  if (!trimmed) return { error: "name-required" };

  const supabase = await createClient();
  const { data: id, error } = await supabase.rpc("suggest_category", {
    p_name: trimmed,
  });
  if (error || !id) return { error: "suggest-failed" };

  const { data: cat } = await supabase
    .from("categories")
    .select("id, slug, name")
    .eq("id", id)
    .maybeSingle<{ id: string; slug: string; name: string }>();
  if (!cat) return { error: "suggest-failed" };

  revalidatePath("/protected/groups/new");
  return cat;
}
