import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  bugReportsEnabled,
  deliverBugReportNotifications,
  hasExhaustedBugReportNotifications,
} from "@/lib/bug-reports/server";
import { deliverMemberNotices, pipelinesEnabled } from "@/lib/member-pipelines/server";
import { startMaintenanceCheckIn } from "@/lib/bug-reports/monitor";
/** Vercel sends CRON_SECRET as the bearer token for the hourly job. */
export async function GET(request: Request) {
  const secret =
    process.env.CRON_SECRET || process.env.BUG_REPORT_MAINTENANCE_SECRET;
  const actual = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (
    !secret ||
    actual.length !== expected.length ||
    !timingSafeEqual(actual, expected)
  )
    return new NextResponse(null, { status: 401 });
  const monitor = await startMaintenanceCheckIn();
  let ok = false;
  // Retention keeps running even if new intake is disabled.
  try {
    const { error } = await createAdminClient().rpc(
      "purge_expired_bug_reports",
    );
    if (error) throw new Error("purge failed");
    if (bugReportsEnabled()) {
      const delivery = await deliverBugReportNotifications();
      if (delivery.failed || await hasExhaustedBugReportNotifications())
        throw new Error("notification delivery needs attention");
    }
    const pipelinePurge = await createAdminClient().rpc("purge_member_pipeline_data");
    if (pipelinePurge.error && !["PGRST202", "42883"].includes(pipelinePurge.error.code))
      throw new Error("pipeline purge failed");
    if (pipelinesEnabled()) await deliverMemberNotices();
    ok = true;
    return NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { ok: false },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  } finally {
    await monitor?.finish(ok);
  }
}
