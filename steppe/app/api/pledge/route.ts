import { NextResponse } from "next/server";
import {
  clientIp,
  rateLimited,
  submitPledge,
  normalizeSlug,
} from "@/lib/pledge";

/**
 * Neighborhood pledge submission (the /n/[slug] page posts here).
 *
 * This route is the ONLY way a pledge is recorded. submit_pledge() is granted to
 * service_role alone (migration 0026), so PostgREST does not expose it and a
 * script cannot skip past the checks below by calling the RPC directly — which
 * is what makes the rate limit and the honeypot real rather than decorative.
 *
 * Body: { slug, email, company? }
 *   - slug     required, must name a neighborhood running a campaign
 *   - email    required; validated here for a decent message and AGAIN in the
 *              database, which is the check that counts
 *   - company  honeypot — a visually-hidden field real people leave empty. If
 *              it is filled we return a plausible-looking success and record
 *              nothing, so a bot is not told it was caught.
 *
 * Returns { ok: true, pledgeCount, threshold, isOpen, alreadyPledged } or
 * { ok: false, error }. Never the row, the id, or the removal token.
 *
 * No `runtime` export: pinning "nodejs" is incompatible with cacheComponents
 * (next.config), and Supabase is reached over fetch, so the default is fine.
 */

function bad(error: string, status = 400) {
  return NextResponse.json({ ok: false, error }, { status });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return bad("Invalid request.");
  }
  const d = (body ?? {}) as Record<string, unknown>;

  // Honeypot: a real person never fills this. Pretend success, record nothing.
  // Deliberately BEFORE the rate limit, so bot traffic cannot burn through a
  // shared NAT's budget and lock out the real neighbors behind it.
  if (typeof d.company === "string" && d.company.trim() !== "") {
    return NextResponse.json({ ok: true, alreadyPledged: true });
  }

  const slug = normalizeSlug(d.slug);
  if (!slug) return bad("Missing neighborhood.");

  // Keyed per (IP, neighborhood): pledging to one neighborhood must not spend
  // the budget for another, and a household adding two or three people to the
  // same list is the good case, not the abuse case.
  if (rateLimited(`${clientIp(request)}:${slug}`)) {
    return bad(
      "Too many pledges from this connection just now. Please try again in a little while.",
      429,
    );
  }

  const outcome = await submitPledge(slug, d.email);

  if (!outcome.ok) {
    switch (outcome.reason) {
      case "invalid_email":
        return bad("That address doesn't look right. Check it and try again.");
      case "unknown_neighborhood":
        return bad("That neighborhood isn't taking pledges.", 404);
      default:
        return bad("Something went wrong. Please try again.", 500);
    }
  }

  const { result } = outcome;
  return NextResponse.json({
    ok: true,
    pledgeCount: result.pledgeCount,
    threshold: result.threshold,
    isOpen: result.isOpen,
    alreadyPledged: result.alreadyPledged,
  });
}
