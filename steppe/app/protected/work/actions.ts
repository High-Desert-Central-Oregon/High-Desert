"use server";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isModerator } from "@/lib/auth";
import {
  canManageOnboarding,
  deliverMemberNotices,
  pipelinesEnabled,
} from "@/lib/member-pipelines/server";
import { UUID } from "@/lib/bug-reports/shared";
export async function retryNotice(form: FormData) {
  const id = form.get("id");
  if (
    !pipelinesEnabled() ||
    typeof id !== "string" ||
    !UUID.test(id) ||
    !((await canManageOnboarding()) || (await isModerator()))
  )
    return { ok: false };
  const db = await createClient();
  const result = await db.rpc("retry_member_notice", { p_id: id });
  if (result.error) return { ok: false };
  after(async () => {
    try {
      await deliverMemberNotices();
    } catch {
      console.error("[member-pipelines] delivery remains pending");
    }
  });
  revalidatePath("/protected/work");
  return { ok: true };
}
