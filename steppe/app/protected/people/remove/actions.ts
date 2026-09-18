"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  canRemoveAccounts,
  completeAccountRemoval,
  type RemovalJob,
} from "@/lib/member-pipelines/removal";
import { inviteEmail } from "@/lib/member-pipelines/shared";
import { UUID } from "@/lib/bug-reports/shared";

export type RemovalPreview = {
  target_id: string;
  email: string;
  display_name: string;
  verified: boolean;
  eligible: boolean;
  removal_id: string | null;
};
export async function previewRemoval(
  value: string,
): Promise<{ ok: boolean; person?: RemovalPreview }> {
  if (!(await canRemoveAccounts())) return { ok: false };
  const email = inviteEmail(value);
  if (!email) return { ok: false };
  const db = await createClient();
  const { data, error } = await db.rpc("preview_account_removal", {
    p_email: email,
  });
  return error ? { ok: false } : { ok: true, person: data?.[0] };
}

async function finishAuthorizedJob(id: string) {
  const db = await createClient();
  const { data: job, error } = await db
    .from("account_removals")
    .select("id,target_id,pending_email,completed_at")
    .eq("id", id)
    .maybeSingle<RemovalJob>();
  if (error || !job) return { state: "failed" as const };
  let complete = false;
  try {
    complete = await completeAccountRemoval(job);
  } catch {
    /* The durable pending job is the retry path; never log member data. */
  }
  revalidatePath("/protected/people/remove");
  revalidatePath("/protected/people");
  revalidatePath("/protected/work");
  return { state: complete ? ("complete" as const) : ("pending" as const) };
}

export async function removeAccount(input: {
  target: string;
  confirmation: string;
  reason: string;
  acknowledged: boolean;
}) {
  if (!(await canRemoveAccounts())) return { state: "failed" as const };
  const email = inviteEmail(input.confirmation);
  if (
    !email ||
    !UUID.test(input.target) ||
    input.acknowledged !== true ||
    !["member_request", "test_reset"].includes(input.reason)
  )
    return { state: "failed" as const };
  const db = await createClient();
  const { data, error } = await db.rpc("begin_account_removal", {
    p_target: input.target,
    p_email: email,
    p_reason: input.reason,
  });
  if (error || typeof data !== "string") return { state: "failed" as const };
  return finishAuthorizedJob(data);
}

export async function retryRemoval(id: string) {
  if (!(await canRemoveAccounts()) || !UUID.test(id))
    return { state: "failed" as const };
  return finishAuthorizedJob(id);
}
