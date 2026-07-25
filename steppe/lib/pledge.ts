/**
 * The neighborhood pledge campaign — one deep module behind a narrow interface.
 *
 * Implements docs/decisions/neighborhood-pledge-campaigns.md (Accepted
 * 2026-07-25). Steppe opens in a neighborhood only once N households have
 * pledged; until then nobody verifies an address and nobody pays anything.
 *
 * WHY EVERYTHING GOES THROUGH AN RPC: the `pledges` table (migration 0026) is
 * unreachable by every client role — RLS with zero policies AND every table
 * privilege revoked, service_role included. There is no `.from("pledges")` to
 * write, here or anywhere. Three of the four functions below are granted to
 * service_role alone, which means the route handler holding the secret key is
 * the ONLY submission path, which in turn is what makes its per-IP limit and
 * honeypot real rather than advisory.
 *
 * Callers only ever touch the four exported functions and their types.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { siteOrigin } from "@/lib/site-url";

/** What the public page and the submit response both report. */
export type NeighborhoodStatus = {
  slug: string;
  name: string;
  /** Households needed before the neighborhood opens. */
  threshold: number;
  pledgeCount: number;
  /**
   * The neighborhood is actually live — a human recorded it (`opened_at`), NOT
   * merely `pledgeCount >= threshold`. Crossing the threshold is arithmetic;
   * opening a neighborhood is work someone does. Use `thresholdReached` for the
   * in-between state.
   */
  isOpen: boolean;
};

export type PledgeResult = NeighborhoodStatus & {
  /** True when this address was already on the list — no second layer, no second email. */
  alreadyPledged: boolean;
};

/** Threshold met but not yet opened — "we got there, it starts shortly". */
export function thresholdReached(s: {
  pledgeCount: number;
  threshold: number;
}): boolean {
  return s.pledgeCount >= s.threshold;
}

/** Households still needed. Never negative. */
export function remaining(s: {
  pledgeCount: number;
  threshold: number;
}): number {
  return Math.max(s.threshold - s.pledgeCount, 0);
}

// Deliberately permissive: real addresses are stranger than most patterns
// allow, and the cost of rejecting a valid one is a neighbor who does not
// pledge. The database applies this same shape check independently — this copy
// exists to produce a decent message, not to be the gate (submit_pledge is).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LEN = 320;

export function normalizeEmail(raw: unknown): string {
  return typeof raw === "string" ? raw.trim().toLowerCase() : "";
}

export function isEmailShaped(email: string): boolean {
  return email.length <= MAX_EMAIL_LEN && EMAIL_RE.test(email);
}

/** Slugs are lowercase and URL-safe; anything else cannot match a campaign. */
export function normalizeSlug(raw: unknown): string {
  return typeof raw === "string" ? raw.trim().toLowerCase() : "";
}

// --- the two URLs that appear in print and in email --------------------------
// Built from siteOrigin() rather than hardcoded, so preview deploys are
// self-referential. In production this resolves to the canonical origin, which
// is what the printed steppe.community/n/<slug> redirects to.
//
// This path shape is load-bearing: it is printed on mailers, door hangers, and
// yard signs, and a printed URL cannot be changed afterwards. Do not restructure
// /n/<slug> without reprinting everything already in the field.

/** The neighborhood's public page — what a pledger forwards to three doors. */
export function pledgeShareUrl(slug: string): string {
  return `${siteOrigin()}/n/${normalizeSlug(slug)}`;
}

/**
 * The token-bearing removal link. Points at a confirmation PAGE, never at an
 * endpoint that deletes on GET — mail scanners and link previewers fetch URLs in
 * the background and would otherwise unsubscribe people who never clicked.
 */
export function pledgeRemovalUrl(slug: string, token: string): string {
  return `${siteOrigin()}/n/${normalizeSlug(slug)}/leave?token=${encodeURIComponent(token)}`;
}

// --- per-IP rate limit -------------------------------------------------------
// Best-effort and in-memory, per serverless instance, resetting on cold start —
// the same shape as app/api/contact/route.ts, and deliberately no new dependency
// (a durable limiter would need shared storage we do not run).
//
// It is honest about what it stops. The count is public and printed on signage,
// so it is a target for inflation; this plus the (neighborhood, email) unique
// constraint handles casual noise and a stuck submit button. Neither stops a
// determined actor with many addresses and many IPs, and Steppe deliberately
// does NOT answer that with CAPTCHA, a confirmation loop, or address
// verification — at this scale those suppress genuine conversions far more than
// abuse, and verifying an address at pledge time would defeat the mechanic
// outright. The proportionate defence is pledge_activity(), which makes
// anomalies visible after the fact.
//
// The window is more generous than the contact form's because the failure mode
// here is a real neighbor turned away: several households behind one venue or
// apartment NAT pledging in the same few minutes is exactly the good case. (The
// /join route disabled its limiter entirely for that reason; a pledge count is
// worth defending a little harder than a mailing list, so this one is on.)
const WINDOW_MS = 10 * 60_000;
const MAX_PER_WINDOW = 6;
const hits = new Map<string, number[]>();

export function rateLimited(key: string): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(key, recent);
  return recent.length > MAX_PER_WINDOW;
}

/** First hop of X-Forwarded-For, or "unknown" — never used for anything but the limit. */
export function clientIp(request: Request): string {
  return (
    (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() ||
    "unknown"
  );
}

// --- reads -------------------------------------------------------------------

type StatusRow = {
  slug: string;
  name: string;
  threshold: number;
  pledge_count: number;
  is_open: boolean;
};

function toStatus(row: StatusRow): NeighborhoodStatus {
  return {
    slug: row.slug,
    name: row.name,
    threshold: row.threshold,
    // count(*) is bigint; supabase-js may hand it back as a string.
    pledgeCount: Number(row.pledge_count),
    isOpen: row.is_open,
  };
}

/**
 * The public count, read with the ANON client — no session, no service key.
 * That is the read-free commitment made literal: if this needed auth, the page
 * would not be readable by someone who just scanned a QR code.
 *
 * Returns null for an unknown slug AND for a real neighborhood that is not
 * running a campaign, so the route 404s either way and Steppe publishes no
 * browsable directory of neighborhoods it has no presence in.
 */
export async function getNeighborhoodStatus(
  slug: string,
): Promise<NeighborhoodStatus | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("neighborhood_status", { p_slug: normalizeSlug(slug) })
    .maybeSingle<StatusRow>();
  if (error || !data) return null;
  return toStatus(data);
}

// --- writes ------------------------------------------------------------------

export type SubmitOutcome =
  | { ok: true; result: PledgeResult }
  | { ok: false; reason: "invalid_email" | "unknown_neighborhood" | "error" };

/**
 * Record one pledge. Idempotent per (neighborhood, address): a repeat submission
 * returns the same count with `alreadyPledged: true` and, crucially, does not
 * inflate the number or re-send the confirmation.
 *
 * Never returns the row, the id, or the removal token — the database function's
 * return type is the contract, so none of those can ride along by accident.
 */
export async function submitPledge(
  slug: string,
  // `unknown`, not `string`: this takes untrusted request input and normalizing
  // it is this function's job. Forcing the caller to coerce first would move a
  // validation decision out of the module that owns it.
  email: unknown,
): Promise<SubmitOutcome> {
  const normalizedEmail = normalizeEmail(email);
  if (!isEmailShaped(normalizedEmail)) {
    return { ok: false, reason: "invalid_email" };
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .rpc("submit_pledge", {
      p_slug: normalizeSlug(slug),
      p_email: normalizedEmail,
    })
    .maybeSingle<StatusRow & { already_pledged: boolean }>();

  if (error) {
    // no_data_found is how submit_pledge reports "no campaign here" — an unknown
    // slug and a real-but-not-campaigning neighborhood are refused identically,
    // so this is not a campaign-existence oracle.
    if (error.code === "P0002" || /no pledge campaign/i.test(error.message)) {
      return { ok: false, reason: "unknown_neighborhood" };
    }
    if (error.code === "23514" || /invalid email/i.test(error.message)) {
      return { ok: false, reason: "invalid_email" };
    }
    return { ok: false, reason: "error" };
  }
  if (!data) return { ok: false, reason: "error" };

  return {
    ok: true,
    result: { ...toStatus(data), alreadyPledged: data.already_pledged },
  };
}

/**
 * The removal token for one pledge, used ONLY to compose the unsubscribe link in
 * the confirmation email. It is fetched separately from submitPledge so it can
 * never travel in an HTTP response, and it is never returned to a caller that
 * is not building an email.
 */
export async function getRemovalToken(
  slug: string,
  email: string,
): Promise<string | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("pledge_removal_token", {
    p_slug: normalizeSlug(slug),
    p_email: normalizeEmail(email),
  });
  if (error || typeof data !== "string") return null;
  return data;
}

/**
 * Hard-delete one pledge by token. Nothing is retained — no tombstone, no
 * suppression flag, no "unsubscribed" row. Verify-then-forget, applied to
 * pre-member data. Returns whether a row existed to remove.
 */
export async function removePledge(token: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("remove_pledge", { p_token: token });
  if (error) return false;
  return data === true;
}
