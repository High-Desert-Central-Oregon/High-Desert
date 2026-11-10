import { NextResponse, after } from "next/server";
import { getLocale } from "next-intl/server";
import { isSignupSourceCode } from "@/lib/signup-source";
import { readLimitedJson } from "@/lib/limited-json";
import { clientIp, rateLimited } from "@/lib/rate-limit";
import {
  queuePublicEnrollment,
  deliverPublicEnrollment,
} from "@/lib/public-enrollment";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await readLimitedJson(request, 4096);
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: "Invalid request." },
      {
        status:
          error instanceof Error && error.message === "too large" ? 413 : 400,
      },
    );
  }
  const data = (body ?? {}) as Record<string, unknown>;
  if (typeof data.company === "string" && data.company.trim())
    return NextResponse.json({ ok: true }, { status: 202 });
  const email =
    typeof data.email === "string" ? data.email.trim().toLowerCase() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320)
    return NextResponse.json(
      { ok: false, error: "Please enter a valid email address." },
      { status: 400 },
    );
  if (data.consent !== true)
    return NextResponse.json(
      { ok: false, error: "Please confirm the checkbox to continue." },
      { status: 400 },
    );
  if (
    rateLimited("interest:global", 600) ||
    rateLimited(`interest:${clientIp(request)}`, 60)
  )
    return NextResponse.json(
      { ok: false, error: "Please try again later." },
      { status: 429 },
    );
  const firstNameRaw =
    typeof data.first_name === "string" ? data.first_name.trim() : "";
  const first_name = firstNameRaw === "" ? null : firstNameRaw.slice(0, 120);

  const neighborhood =
    typeof data.neighborhood === "string"
      ? data.neighborhood.trim().slice(0, 120) || null
      : null;
  const in_area = typeof data.in_area === "boolean" ? data.in_area : null;

  // Never trust the raw query-string/body value into the column: coerce
  // anything outside the allowlist (missing, malformed, or a hostile string
  // sent directly to this route) to 'direct'.
  const source =
    typeof data.source === "string" && isSignupSourceCode(data.source)
      ? data.source
      : "direct";

  const result = await queuePublicEnrollment(request, {
    email,
    purpose: "interest",
    slug: "",
    locale: await getLocale(),
    payload: { first_name, neighborhood, in_area, consent: true, source },
  });
  if (result !== "queued")
    return NextResponse.json(
      { ok: false, error: "Please try again later." },
      { status: result === "limited" ? 429 : 503 },
    );
  after(async () => {
    try {
      if (!(await deliverPublicEnrollment()))
        console.error("Public enrollment delivery pending");
    } catch {
      console.error("Public enrollment delivery pending");
    }
  });
  return NextResponse.json(
    { ok: true },
    { status: 202, headers: { "Cache-Control": "no-store" } },
  );
}
