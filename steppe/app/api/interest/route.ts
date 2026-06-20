import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Pre-launch interest capture (app/(site)/join → here).
 *
 * Server-only POST. The interest_signups table is RLS deny-by-default with NO
 * policies (migration 0014), so it can be written only by the service-role
 * client — which lives in lib/supabase/admin.ts and is NEVER importable by client
 * code (the secret key is not NEXT_PUBLIC_*). This route is the single writer.
 *
 * Body: { email, first_name?, in_area?, consent, company? }
 *   - email     required, validated
 *   - consent   required true (the form's "email me when ready" checkbox)
 *   - company   honeypot — a visually-hidden field real people leave empty;
 *               if it's filled we treat the request as a bot and drop it
 *               silently (return ok without inserting, so we don't tip it off).
 *
 * Returns { ok: true } on insert, { ok: true, duplicate: true } if the email was
 * already on the list (on-conflict-do-nothing), or { ok: false, error } on a bad
 * request. We never reveal anything about who else is on the list.
 */

// Service-role usage must run on the Node.js runtime, not the edge.
export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid request." },
      { status: 400 },
    );
  }

  const data = (body ?? {}) as Record<string, unknown>;

  // Honeypot: a real person never fills this. Pretend success, insert nothing.
  if (typeof data.company === "string" && data.company.trim() !== "") {
    return NextResponse.json({ ok: true });
  }

  const email =
    typeof data.email === "string" ? data.email.trim().toLowerCase() : "";
  if (!EMAIL_RE.test(email) || email.length > 320) {
    return NextResponse.json(
      { ok: false, error: "Please enter a valid email address." },
      { status: 400 },
    );
  }

  if (data.consent !== true) {
    return NextResponse.json(
      { ok: false, error: "Please confirm the checkbox to continue." },
      { status: 400 },
    );
  }

  const firstNameRaw =
    typeof data.first_name === "string" ? data.first_name.trim() : "";
  const first_name = firstNameRaw === "" ? null : firstNameRaw.slice(0, 120);

  const in_area = typeof data.in_area === "boolean" ? data.in_area : null;

  const admin = createAdminClient();

  // On-conflict-do-nothing on the unique email. With ignoreDuplicates an existing
  // email yields no returned row, which is how we report `duplicate` without ever
  // querying for who is already signed up.
  const { data: inserted, error } = await admin
    .from("interest_signups")
    .upsert(
      { email, first_name, in_area, consent: true },
      { onConflict: "email", ignoreDuplicates: true },
    )
    .select("id");

  if (error) {
    return NextResponse.json(
      { ok: false, error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }

  const duplicate = !inserted || inserted.length === 0;
  return NextResponse.json(duplicate ? { ok: true, duplicate: true } : { ok: true });
}
