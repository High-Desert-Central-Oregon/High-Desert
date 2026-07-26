import { NextResponse, after } from "next/server";
import { getTranslations } from "next-intl/server";
import {
  submitPledge,
  normalizeSlug,
  normalizeEmail,
  getRemovalToken,
  pledgeShareUrl,
  pledgeRemovalUrl,
  type PledgeResult,
} from "@/lib/pledge";
import { clientIp, rateLimited } from "@/lib/rate-limit";
import { sendPledgeConfirmation } from "@/lib/pledge-email";

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

  // A NEW pledge gets exactly one confirmation. A repeat submission gets none —
  // that address was already welcomed, and re-sending would make a stuck submit
  // button look like Steppe mailing you twice.
  if (!result.alreadyPledged) {
    await queueConfirmation(slug, normalizeEmail(d.email), result);
  }

  return NextResponse.json({
    ok: true,
    pledgeCount: result.pledgeCount,
    threshold: result.threshold,
    isOpen: result.isOpen,
    alreadyPledged: result.alreadyPledged,
  });
}

/**
 * Compose the confirmation now, send it after the response.
 *
 * The composition (translations, the removal token) happens inside the request
 * so it can use the request's locale cookie; only the network call to Resend is
 * deferred. `after()` is what makes "must not block the HTTP response" true
 * without the send being killed — a bare un-awaited promise in a serverless
 * function can be torn down the moment the response is returned, which would
 * drop confirmations silently and only under load.
 *
 * Every failure path here is swallowed and logged. The pledge is already
 * recorded and the neighbor has already seen their count go up; a mail problem
 * must not retroactively turn that into an error.
 */
async function queueConfirmation(
  slug: string,
  email: string,
  result: PledgeResult,
) {
  try {
    const t = await getTranslations("pledgeEmail");
    const token = await getRemovalToken(slug, email);
    if (!token) {
      console.error("[pledge] no removal token; confirmation not sent", { slug });
      return;
    }

    const name = result.name;
    const vars = {
      neighborhood: name,
      count: result.pledgeCount,
      threshold: result.threshold,
    };

    const payload = {
      to: email,
      subject: t("subject", vars),
      heading: t("heading"),
      paragraphs: [
        t("body1", vars),
        t("body2", vars),
        t("body3"),
        // body4 describes what a pledger actually gets between pledging and the
        // neighborhood opening: a live count, and nothing else. It deliberately
        // makes no promise about reading posted content — /protected/* is behind
        // auth and behind the LAUNCH_PHASE gate, so there is no public read
        // surface to promise. If one ever ships, this string is where a read
        // promise may be reinstated, and not before: the promise follows the
        // capability, never the reverse.
        t("body4", vars),
        // Signed with a personal name, then the role, then the standing claim.
        // Three paragraphs rather than one string with newlines, because the
        // HTML shell renders each paragraph in its own <p> and an embedded
        // newline would collapse into "Greg Founding Director, Steppe".
        t("signoff"),
        t("signoffRole"),
        t("tagline"),
      ],
      shareUrl: pledgeShareUrl(slug),
      shareLabel: t("shareLabel"),
      removeUrl: pledgeRemovalUrl(slug, token),
      removeLabel: t("removeLabel"),
      privacyNote: t("privacyNote"),
    };

    after(async () => {
      const sent = await sendPledgeConfirmation(payload);
      if (!sent.ok && sent.code === "send") {
        console.error("[pledge] confirmation send failed", { slug });
      }
    });
  } catch {
    // Localization or token lookup failed. The pledge stands.
    console.error("[pledge] could not compose confirmation", { slug });
  }
}
