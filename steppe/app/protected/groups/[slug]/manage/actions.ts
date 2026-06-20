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
