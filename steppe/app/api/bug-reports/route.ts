import { createHmac } from "node:crypto";
import { after, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseReport } from "@/lib/bug-reports/shared";
import {
  bugReportsEnabled,
  deliverBugReportNotifications,
  readLimitedJson,
  reportRelease,
} from "@/lib/bug-reports/server";
const failure = (status: number) =>
  NextResponse.json(
    { ok: false },
    { status, headers: { "Cache-Control": "no-store" } },
  );
export async function POST(request: Request) {
  if (!bugReportsEnabled()) return failure(503);
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return failure(403);
  let input;
  try {
    input = parseReport(await readLimitedJson(request));
  } catch {
    return failure(400);
  }
  if (!input) return failure(400);
  try {
    const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!secret) return failure(503);
    const session = await createClient();
    const {
      data: { user },
      error: authError,
    } = await session.auth.getUser();
    // Missing session is expected on public/login pages. An outage is not anonymity.
    if (authError && authError.name !== "AuthSessionMissingError")
      return failure(503);
    const ip = (request.headers.get("x-forwarded-for") ?? "unknown")
      .split(",")[0]
      .trim();
    const bucket = createHmac("sha256", secret)
      .update(`steppe-bug:${ip}`)
      .digest("hex");
    const { data, error } = await createAdminClient().rpc("submit_bug_report", {
      p_key: input.requestKey,
      p_reporter: user?.id ?? null,
      p_description: input.description,
      p_expected: input.expected,
      p_email: input.email,
      p_page: input.page,
      p_locale: input.locale,
      p_release: reportRelease(),
      p_diagnostics: input.diagnostics,
      p_bucket: bucket,
    });
    if (error || !data) return failure(error?.code === "P0001" ? 429 : 503);
    after(async () => {
      try {
        await deliverBugReportNotifications(data);
      } catch {
        console.error("[bug-reports] alert pending; retry required");
      }
    });
    return NextResponse.json(
      { ok: true, id: data },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return failure(503);
  }
}
