"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/auth";
import type { GroupVisibility, GroupJoinPolicy, GroupMemberRole } from "@/lib/types/db";

export type SettingsState = { ok: true } | { error: string } | null;
export type MemberActionState = { ok: true } | { error: string } | null;

/**
 * Every action here is a thin wrapper over a 1a maintainer RPC. Authority is the
 * RPC's `is_group_maintainer(p_group)` check, which acts only on that group (G9,
 * G12); the profile check here is just a friendly early-out. The client never
 * sets role/status — the RPC does (G8-G10/G12).
 */
async function requireVerified() {
  const profile = await getMyProfile();
  if (!profile) redirect("/auth/login");
  if (!profile.verified) return null;
  return profile;
}

/** Map a Postgres RAISE from the last-maintainer guards to a clear code. */
function mapError(message: string | undefined): string {
  const m = (message ?? "").toLowerCase();
  if (m.includes("last maintainer") || m.includes("only maintainer")) {
    return "last-maintainer";
  }
  return "action-failed";
}

export async function updateGroupSettings(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  if (!(await requireVerified())) return { error: "forbidden" };

  const groupId = String(formData.get("group_id") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const categoryRaw = String(formData.get("category_id") ?? "").trim();
  const visibility = String(formData.get("visibility") ?? "").trim();
  const joinPolicy = String(formData.get("join_policy") ?? "").trim();

  if (!groupId) return { error: "action-failed" };
  if (!name) return { error: "name-required" };
  if (visibility !== "public" && visibility !== "members_only")
    return { error: "action-failed" };
  if (joinPolicy !== "open" && joinPolicy !== "request" && joinPolicy !== "locked")
    return { error: "action-failed" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_group_settings", {
    p_group: groupId,
    p_name: name,
    p_description: description.length > 0 ? description : null,
    p_category_id: categoryRaw.length > 0 ? categoryRaw : null,
    p_visibility: visibility as GroupVisibility,
    p_join_policy: joinPolicy as GroupJoinPolicy,
  });
  if (error) return { error: mapError(error.message) };

  if (slug) revalidatePath(`/protected/groups/${slug}/manage`);
  return { ok: true };
}

async function callMemberRpc(
  fn: "approve_member" | "deny_member" | "remove_member" | "add_member",
  groupId: string,
  userId: string,
  slug: string,
): Promise<MemberActionState> {
  if (!(await requireVerified())) return { error: "forbidden" };
  if (!groupId || !userId) return { error: "action-failed" };

  const supabase = await createClient();
  const { error } = await supabase.rpc(fn, { p_group: groupId, p_user: userId });
  if (error) return { error: mapError(error.message) };

  revalidatePath(`/protected/groups/${slug}/manage`);
  return { ok: true };
}

export async function approveMember(groupId: string, userId: string, slug: string) {
  return callMemberRpc("approve_member", groupId, userId, slug);
}
export async function denyMember(groupId: string, userId: string, slug: string) {
  return callMemberRpc("deny_member", groupId, userId, slug);
}
export async function removeMember(groupId: string, userId: string, slug: string) {
  return callMemberRpc("remove_member", groupId, userId, slug);
}
export async function addMember(groupId: string, userId: string, slug: string) {
  return callMemberRpc("add_member", groupId, userId, slug);
}

/**
 * Search verified members to add to a group — the bounded replacement for
 * prefetching every verified profile into an "add member" dropdown
 * (perf-audit-v1 finding #6). Reads only `public_profiles` (already readable by
 * any verified member — no new exposure) with an `ilike` on the name, capped at
 * 20 rows, and drops anyone already in the group. Returns [] until the caller
 * types a couple of characters, so a maintainer never pulls the whole
 * membership just to open the picker.
 */
export async function searchGroupCandidates(
  groupId: string,
  query: string,
): Promise<{ id: string; name: string }[]> {
  if (!(await requireVerified())) return [];
  const q = query.trim();
  if (!groupId || q.length < 2) return [];
  const pat = q.replace(/[%_\\]/g, ""); // strip ilike wildcards — literal search
  if (pat.length < 2) return [];

  const supabase = await createClient();
  // Current members (any status) to exclude — gm_read returns the roster to an
  // active member; a non-member simply excludes nothing (RLS returns no rows).
  const { data: roster } = await supabase
    .from("group_members")
    .select("user_id")
    .eq("group_id", groupId);
  const memberIds = new Set((roster ?? []).map((r) => r.user_id));

  const { data: people } = await supabase
    .from("public_profiles")
    .select("id, display_name")
    .eq("verified", true)
    .ilike("display_name", `%${pat}%`)
    .order("display_name", { ascending: true })
    .limit(20);

  return (people ?? [])
    .filter((p) => !memberIds.has(p.id))
    .map((p) => ({ id: p.id, name: p.display_name }));
}

export async function setMemberRole(
  groupId: string,
  userId: string,
  role: GroupMemberRole,
  slug: string,
): Promise<MemberActionState> {
  if (!(await requireVerified())) return { error: "forbidden" };
  if (!groupId || !userId) return { error: "action-failed" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_member_role", {
    p_group: groupId,
    p_user: userId,
    p_role: role,
  });
  if (error) return { error: mapError(error.message) };

  revalidatePath(`/protected/groups/${slug}/manage`);
  return { ok: true };
}
