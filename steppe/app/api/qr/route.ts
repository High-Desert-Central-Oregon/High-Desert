import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * QR A/B aggregate counter (first-party, zero-PII).
 *
 * The printed pre-launch QR codes carry ?utm_content=quiet|square. /join fires a
 * 'scan' on arrival and a 'join' when the interest form is submitted, both from
 * the SAME browser session. This route increments four rolling per-day counters
 * in qr_counts (variant × kind) and NOTHING else: it reads, stores, and logs no
 * IP, user-agent, cookie, or identifier of any kind. That is what keeps it inside
 * CLAUDE.md invariant 8 and the live "no third-party trackers, no behavioral
 * profiles" promise — it counts events, not people.
 *
 * qr_counts is RLS deny-by-default with NO policies (migration 0015), so only the
 * service-role client (lib/supabase/admin.ts) can write it, through the
 * increment_qr_count() RPC. This route is the single writer. No `export const
 * runtime` — pinning a runtime conflicts with cacheComponents (next.config).
 */

const VARIANTS = new Set(["quiet", "square"]);
const KINDS = new Set(["scan", "join"]);

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  const data = (body ?? {}) as Record<string, unknown>;
  const variant = typeof data.variant === "string" ? data.variant : "";
  const kind = typeof data.kind === "string" ? data.kind : "";

  // Reject anything that isn't one of the four known counters — and do nothing.
  if (!VARIANTS.has(variant) || !KINDS.has(kind)) {
    return new NextResponse(null, { status: 400 });
  }

  // Atomic per-day increment via the service role. We pass only the two validated
  // labels; no request metadata (headers, IP, UA) is read, stored, or logged.
  const { error } = await createAdminClient().rpc("increment_qr_count", {
    p_variant: variant,
    p_kind: kind,
  });
  if (error) {
    return new NextResponse(null, { status: 500 });
  }

  return new NextResponse(null, { status: 204 });
}
