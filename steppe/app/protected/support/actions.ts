"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  deliverBugReportNotifications,
  isSupportOperator,
} from "@/lib/bug-reports/server";
import { UUID } from "@/lib/bug-reports/shared";
import { bugCopy } from "@/lib/bug-reports/copy";
export async function updateReport(id: string, status: string, note: string) {
  if (
    !UUID.test(id) ||
    !Object.hasOwn(bugCopy.en.statuses, status) ||
    note.length > 2000 ||
    !(await isSupportOperator())
  )
    return { ok: false };
  const db = await createClient();
  const { error } = await db.rpc("update_bug_report", {
    p_id: id,
    p_status: status,
    p_note: note.trim(),
  });
  if (error) return { ok: false };
  revalidatePath("/protected/support");
  revalidatePath(`/protected/support/${id}`);
  return { ok: true };
}
export async function retryReportNotification(id: string) {
  if (!UUID.test(id) || !(await isSupportOperator())) return { ok: false };
  const db = await createClient();
  const { error } = await db.rpc("retry_bug_report_notification", { p_id: id });
  if (error) return { ok: false };
  try {
    await deliverBugReportNotifications(id);
  } catch {
    return { ok: false };
  }
  revalidatePath("/protected/support");
  revalidatePath(`/protected/support/${id}`);
  return { ok: true };
}
