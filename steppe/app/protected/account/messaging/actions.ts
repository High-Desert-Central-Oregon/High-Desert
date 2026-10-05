"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getMyProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  attemptMessageAction,
  type MessageActionState,
} from "@/lib/messages/action-result";
export type ConsentState = MessageActionState | { saved: true };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
async function save(data: FormData, rules: boolean): Promise<ConsentState> {
  let saved = false;
  const result = await attemptMessageAction(async () => {
    const profile = await getMyProfile();
    if (!profile) redirect("/auth/login");
    if (!profile.verified) return { error: "send-failed" };
    const groupId = String(data.get("group_id") ?? "");
    if (!UUID.test(groupId)) return { error: "send-failed" };
    const db = await createClient();
    const version = Number(data.get("version"));
    const disabling = data.get("disable") === "1";
    if (
      !rules &&
      !disabling &&
      (!Number.isSafeInteger(version) ||
        version < 1 ||
        data.get("acknowledge") !== "on")
    )
      return { error: "send-failed" };
    const body = String(data.get("rules") ?? "").trim();
    if (rules && body.length > 2000) return { error: "send-failed" };
    const { error } = rules
      ? await db.rpc("set_group_messaging_rules", {
          p_group: groupId,
          p_rules: body || null,
        })
      : disabling
        ? await db.rpc("disable_group_contact", { p_group: groupId })
        : await db.rpc("set_group_contact_preference", {
            p_group: groupId,
            p_version: version,
            p_allow: data.get("allow") === "on",
          });
    if (error) return { error: "send-failed" };
    saved = true;
    revalidatePath("/protected/groups", "layout");
    revalidatePath("/protected/account/messaging");
    return null;
  });
  return saved ? { saved: true } : result;
}
export async function saveGroupContact(
  _previous: ConsentState,
  data: FormData,
) {
  return save(data, false);
}
export async function saveGroupRules(_previous: ConsentState, data: FormData) {
  return save(data, true);
}
