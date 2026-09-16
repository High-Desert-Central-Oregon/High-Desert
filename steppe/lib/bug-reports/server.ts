import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { durableOrigin } from "@/lib/site-url";

export function bugReportsEnabled() {
  return process.env.BUG_REPORTS_ENABLED === "true";
}
export function reportRelease() {
  const value =
    process.env.VERCEL_GIT_COMMIT_SHA ??
    process.env.STEPPE_RELEASE_ID ??
    "local";
  return /^[a-zA-Z0-9._-]{1,80}$/.test(value) ? value : "unknown";
}
export async function isSupportOperator() {
  if (!bugReportsEnabled()) return false;
  const db = await createClient();
  const { data, error } = await db.rpc("is_support_operator");
  return !error && data === true;
}
/** Report rows ARE the durable outbox. No descriptions or diagnostics in emails. */
export async function deliverBugReportNotifications(id?: string) {
  const db = createAdminClient();
  const { data, error } = await db.rpc("claim_bug_report_notifications", {
    p_id: id ?? null,
  });
  if (error) throw new Error("bug-report notification claim failed");
  const delivery = { attempted: 0, sent: 0, failed: 0 };
  for (const row of (data ?? []) as { id: string; claim: string }[]) {
    delivery.attempted += 1;
    let sent = false;
    try {
      if (process.env.RESEND_API_KEY && process.env.BUG_REPORT_NOTIFY_TO) {
        const { Resend } = await import("resend");
        const resend = new Resend(process.env.RESEND_API_KEY);
        const result = await resend.emails.send(
          {
            from: process.env.CONTACT_FROM ?? "Steppe <hello@steppe.community>",
            to: process.env.BUG_REPORT_NOTIFY_TO,
            subject: `Steppe bug report ${row.id.slice(0, 8)}`,
            text: `A bug report is ready for review. Sign in to Steppe to view it:\n${durableOrigin()}/protected/support/${row.id}\n\nThis alert contains no report content.`,
          },
          { idempotencyKey: `steppe-bug-${row.id}` },
        );
        sent = !result.error;
      }
    } catch {
      /* The saved record remains pending. Never log submitted content. */
    }
    const { error: finishError } = await db.rpc(
      "finish_bug_report_notification",
      { p_id: row.id, p_claim: row.claim, p_sent: sent },
    );
    if (finishError)
      throw new Error("bug-report notification completion failed");
    if (sent) delivery.sent += 1;
    else delivery.failed += 1;
  }
  return delivery;
}
/** Keep exhausted deliveries unhealthy until retry succeeds or the case expires. */
export async function hasExhaustedBugReportNotifications() {
  const now = new Date().toISOString();
  const { count, error } = await createAdminClient()
    .from("bug_reports")
    .select("id", { count: "exact", head: true })
    .eq("notification_state", "pending")
    .gte("notification_attempts", 8)
    .gt("expires_at", now)
    .or(`notification_lease_until.is.null,notification_lease_until.lt.${now}`);
  if (error || count === null)
    throw new Error("bug-report notification health check failed");
  return count > 0;
}
export async function readLimitedJson(
  request: Pick<Request, "headers" | "body">,
  limit = 64_000,
): Promise<unknown> {
  if (Number(request.headers.get("content-length")) > limit)
    throw new Error("too large");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("empty");
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > limit) {
        await reader.cancel();
        throw new Error("too large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
