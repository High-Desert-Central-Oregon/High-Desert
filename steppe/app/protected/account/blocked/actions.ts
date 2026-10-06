"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getMyProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  attemptMessageAction,
  type MessageActionState,
} from "@/lib/messages/action-result";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function unblockMember(
  _previous: MessageActionState,
  data: FormData,
): Promise<MessageActionState> {
  return attemptMessageAction(async () => {
    const profile = await getMyProfile();
    if (!profile) redirect("/auth/login");
    const blocked = String(data.get("blocked_id") ?? "");
    if (
      !UUID.test(blocked) ||
      blocked.toLowerCase() === profile.id.toLowerCase() ||
      data.get("confirm") !== "1"
    )
      return { error: "send-failed" };
    const db = await createClient();
    // Only the acting member's outgoing block. Never clear the other member's block
    // or change the conversation/request state as a side effect of unblocking.
    const { error } = await db
      .from("member_blocks")
      .delete()
      .eq("blocker_id", profile.id)
      .eq("blocked_id", blocked);
    if (error) return { error: "send-failed" };
    revalidatePath("/protected/account/blocked");
    revalidatePath("/protected/messages", "layout");
    revalidatePath("/protected/groups", "layout");
    redirect("/protected/account/blocked?saved=1");
  });
}
