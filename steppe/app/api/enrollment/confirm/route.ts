import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { readLimitedJson } from "@/lib/limited-json";
import { clientIp, rateLimited } from "@/lib/rate-limit";
export async function POST(request: Request) {
  const headers = {
    "Cache-Control": "no-store",
    "Referrer-Policy": "no-referrer",
  };
  if (
    rateLimited("enrollment-confirm:global", 600) ||
    rateLimited(`enrollment-confirm:${clientIp(request)}`, 60)
  )
    return NextResponse.json({ ok: false }, { status: 429, headers });
  try {
    const body = (await readLimitedJson(request, 1024)) as { token?: unknown };
    if (typeof body?.token !== "string" || !/^[a-f0-9]{64}$/.test(body.token))
      return NextResponse.json({ ok: false }, { status: 400, headers });
    const { data, error } = await createAdminClient().rpc(
      "confirm_public_enrollment",
      { p_token: body.token },
    );
    if (error || !data)
      return NextResponse.json(
        { ok: false },
        { status: error ? 503 : 400, headers },
      );
    // Only the holder of the emailed 256-bit credential can receive this link.
    const removeUrl =
      data.purpose === "pledge" && typeof data.removal_token === "string"
        ? `/n/${encodeURIComponent(data.slug)}/leave?token=${encodeURIComponent(data.removal_token)}`
        : null;
    return NextResponse.json({ ok: true, removeUrl }, { headers });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400, headers });
  }
}
