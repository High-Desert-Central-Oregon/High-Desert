import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  bugReportsEnabled,
  deliverBugReportNotifications,
  hasExhaustedBugReportNotifications,
} from "@/lib/bug-reports/server";
import {
  deliverMemberNotices,
  pipelinesEnabled,
} from "@/lib/member-pipelines/server";
import { startMaintenanceCheckIn } from "@/lib/bug-reports/monitor";
import { cleanupOrphanEvidence } from "@/lib/member-pipelines/evidence-cleanup";
import { deliverPublicEnrollment } from "@/lib/public-enrollment";
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
  let ok = true;
  // Retention and cleanup must still run when an independent mail provider or
  // pipeline fails. Return one visible health result after attempting each lane.
  async function run(task: () => Promise<boolean>) {
    try {
      if (!(await task())) ok = false;
    } catch {
      ok = false;
    }
  }
  try {
    await run(
      async () =>
        !(await createAdminClient().rpc("purge_expired_bug_reports")).error,
    );
    await run(async () => {
      const result = await createAdminClient().rpc(
        "purge_member_pipeline_data",
      );
      return !result.error || ["PGRST202", "42883"].includes(result.error.code);
    });
    await run(
      async () =>
        !(await createAdminClient().rpc("purge_public_enrollment")).error,
    );
    await run(
      async () =>
        !(await createAdminClient().rpc("refresh_public_pledge_counts")).error,
    );
    await run(cleanupOrphanEvidence);
    if (bugReportsEnabled())
      await run(async () => {
        const delivery = await deliverBugReportNotifications();
        return (
          !delivery.failed && !(await hasExhaustedBugReportNotifications())
        );
      });
    if (pipelinesEnabled())
      await run(async () => {
        await deliverMemberNotices();
        return true;
      });
    await run(deliverPublicEnrollment);
    return NextResponse.json(
      { ok },
      { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } },
    );
  } finally {
    await monitor?.finish(ok);
  }
}
