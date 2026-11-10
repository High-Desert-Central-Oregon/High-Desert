import { NextResponse, after } from "next/server";
import { getLocale } from "next-intl/server";
import {
  normalizeSlug,
  normalizeEmail,
  isEmailShaped,
} from "@/lib/pledge-shared";
import { readLimitedJson } from "@/lib/limited-json";
import { clientIp, rateLimited } from "@/lib/rate-limit";
import {
  queuePublicEnrollment,
  deliverPublicEnrollment,
} from "@/lib/public-enrollment";
function bad(error: string, status = 400) {
  return NextResponse.json({ ok: false, error }, { status });
}
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await readLimitedJson(request, 4096);
  } catch (error) {
    const oversized = error instanceof Error && error.message === "too large";
    return bad(
      oversized ? "Request too large." : "Invalid request.",
      oversized ? 413 : 400,
    );
  }
  const d = (body ?? {}) as Record<string, unknown>;

  // Honeypot: a real person never fills this. Pretend success, record nothing.
  // Deliberately BEFORE the rate limit, so bot traffic cannot burn through a
  // shared NAT's budget and lock out the real neighbors behind it.
  if (typeof d.company === "string" && d.company.trim() !== "") {
    return NextResponse.json({ ok: true }, { status: 202 });
  }

  const slug = normalizeSlug(d.slug);
  if (!slug || slug.length > 80 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))
    return bad("Invalid neighborhood.");

  // A changing campaign cannot reset the caller or process budget. Keep a
  // separate generous caller allowance for households pledging across campaigns.
  const ip = clientIp(request);
  if (
    rateLimited("pledge:global", 600) ||
    rateLimited(`pledge:ip:${ip}`, 60) ||
    rateLimited(`pledge:${ip}:${slug}`)
  ) {
    return bad(
      "Too many pledges from this connection just now. Please try again in a little while.",
      429,
    );
  }

  const email = normalizeEmail(d.email);
  if (!isEmailShaped(email)) return bad("Please enter a valid email address.");
  const result = await queuePublicEnrollment(request, {
    email,
    purpose: "pledge",
    slug,
    locale: await getLocale(),
    payload: {},
  });
  if (result !== "queued")
    return bad(
      result === "unknown"
        ? "That neighborhood is not taking pledges."
        : "Please try again later.",
      result === "limited" ? 429 : result === "unknown" ? 404 : 503,
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
