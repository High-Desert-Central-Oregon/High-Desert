"use server";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isModerator } from "@/lib/auth";
import {
  pipelinesEnabled,
  deliverMemberNotices,
} from "@/lib/member-pipelines/server";
import { UUID } from "@/lib/bug-reports/shared";
import { EVIDENCE_BUCKET } from "@/lib/verification";
function refresh(id: string) {
  revalidatePath("/protected/review");
  revalidatePath(`/protected/review/${id}`);
  revalidatePath("/protected/verify");
  revalidatePath("/protected/work");
  after(async () => {
    try {
      await deliverMemberNotices();
    } catch {
      console.error("[member-pipelines] review email pending");
    }
  });
}
export async function requestInformation(id: string, question: string) {
  if (
    !pipelinesEnabled() ||
    !UUID.test(id) ||
    typeof question !== "string" ||
    question.trim().length < 5 ||
    question.length > 1200 ||
    !(await isModerator())
  )
    return { ok: false };
  const db = await createClient();
  const result = await db.rpc("request_verification_information", {
    p_id: id,
    p_question: question.trim(),
  });
  if (result.error) return { ok: false };
  refresh(id);
  return { ok: true };
}
export async function replyToReview(id: string, reply: string) {
  if (
    !pipelinesEnabled() ||
    !UUID.test(id) ||
    typeof reply !== "string" ||
    reply.trim().length < 2 ||
    reply.length > 1200
  )
    return { ok: false };
  const db = await createClient();
  const result = await db.rpc("reply_to_verification", {
    p_id: id,
    p_reply: reply.trim(),
  });
  if (result.error) return { ok: false };
  refresh(id);
  return { ok: true };
}
export async function completeReview(
  id: string,
  approve: boolean,
  message: string,
) {
  if (
    !pipelinesEnabled() ||
    !UUID.test(id) ||
    typeof approve !== "boolean" ||
    typeof message !== "string" ||
    message.length > 1200 ||
    !(await isModerator())
  )
    return { ok: false };
  const db = await createClient();
  const started = await db.rpc("begin_verification_decision", {
    p_id: id,
    p_approve: approve,
    p_message: message.trim(),
  });
  const stage = started.data?.[0] as
    | { token: string; evidence_path: string | null; completed: boolean }
    | undefined;
  if (started.error || !stage) return { ok: false };
  if (stage.completed) {
    refresh(id);
    return { ok: true };
  }
  try {
    const admin = createAdminClient();
    if (stage.evidence_path) {
      const deleted = await admin.storage
        .from(EVIDENCE_BUCKET)
        .remove([stage.evidence_path]);
      if (deleted.error) return { ok: false };
    }
    const purged = await admin.rpc("confirm_verification_purge", {
      p_id: id,
      p_token: stage.token,
    });
    if (purged.error) return { ok: false };
    const decided = await db.rpc("decide_verification", {
      p_id: id,
      p_approve: approve,
    });
    if (decided.error) return { ok: false };
    refresh(id);
    return { ok: true };
  } catch {
    return { ok: false };
  } finally {
    revalidatePath(`/protected/review/${id}`);
    revalidatePath("/protected/review");
  }
}
