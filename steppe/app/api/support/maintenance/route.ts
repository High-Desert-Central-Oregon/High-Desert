import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  bugReportsEnabled,
  deliverBugReportNotifications,
} from "@/lib/bug-reports/server";
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
  // Retention keeps running even if new intake is disabled.
  try {
    const { error } = await createAdminClient().rpc(
      "purge_expired_bug_reports",
    );
    if (error) throw new Error("purge failed");
    if (bugReportsEnabled()) await deliverBugReportNotifications();
    return NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { ok: false },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
