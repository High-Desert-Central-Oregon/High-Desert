import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendInterestConfirmation } from "@/lib/interest-email";

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


const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// --- Abuse limiter (SCAFFOLDED, INTENTIONALLY OFF) --------------------------
// This route now sends outbound mail, so a scripted flood of DISTINCT addresses
// could try to use Steppe as a confirmation-spam relay. We deliberately do NOT
// enforce a per-IP limit yet: the Phase 1 launch — a room of people behind one
// venue NAT signing up at once — would trip it. Today's backstops are the
// honeypot below, the on-conflict dedup (each address is mailed at most once),
// and Resend's own account send caps. When volume warrants, implement one of:
//   (a) a generous per-IP window (see app/api/contact/route.ts for the pattern), or
//   (b) a global circuit-breaker (cap total sends/min across the instance).
// To turn it on, fill in this body; the call site below already honors the result.
function interestRateLimited(_ip: string): boolean {
  return false; // not implemented — no enforcement yet; every request passes.
}

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

  // Abuse limiter — scaffolded but inert (see interestRateLimited above).
  const ip =
    (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() ||
    "unknown";
  if (interestRateLimited(ip)) {
    return NextResponse.json(
      {
        ok: false,
        error: "Too many signups just now. Please try again in a little while.",
      },
      { status: 429 },
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

  // New signup → send a one-time confirmation in the member's current language
  // (locale resolved from the NEXT_LOCALE cookie via i18n/request.ts). Best-effort
  // and fully swallowed: the row is already written, so a missing key (local dev)
  // or a provider hiccup must never turn a successful signup into an error. We do
  // NOT re-confirm a duplicate — that address was already welcomed once.
  if (!duplicate) {
    try {
      const t = await getTranslations("interestEmail");
      const greeting = first_name
        ? t("greetingNamed", { name: first_name })
        : t("greeting");
      // Paragraphs for both the plain-text part and the branded HTML shell. The
      // shell's footer already carries "Steppe · Redmond, Oregon", so `place` is
      // not repeated in the body.
      const paragraphs = [
        greeting,
        t("body1"),
        t("body2"),
        t("body3"),
        t("body4"),
        t("signoff"),
      ];
      await sendInterestConfirmation({
        to: email,
        subject: t("subject"),
        heading: t("emailHeading"),
        paragraphs,
      });
    } catch {
      // Localization or delivery failure must not break the signup. Swallow.
    }
  }

  return NextResponse.json(duplicate ? { ok: true, duplicate: true } : { ok: true });
}
