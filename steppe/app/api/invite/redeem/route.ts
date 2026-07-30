import { NextResponse } from "next/server";
import { normalizeToken, normalizeInviteEmail, redeemInvite } from "@/lib/invite";
import { clientIp, rateLimited } from "@/lib/rate-limit";

/**
 * Redeem an invite token for one email address (the /invite page posts here).
 *
 * This route is the ONLY door. `redeem_invite()` is granted to service_role
 * alone (migration 0027, G-INV-4), so PostgREST does not expose it and a script
 * cannot step around the rate limit below by calling the RPC directly. That is
 * what makes the limit real rather than advisory.
 *
 * ONE NEUTRAL FAILURE, ON PURPOSE. Unknown token, expired, exhausted, revoked,
 * and malformed address all return the SAME message with the same status. The
 * cap is a blast-radius dial, not an abuse budget, and a response that
 * distinguished "expired" from "never existed" would let a holder of one card
 * probe the state of a campaign they were not given. The database already
 * refuses to say why; this must not say it for them.
 *
 * WHAT SUCCESS MEANS, EXACTLY. `{ ok: true }` means the address is now on
 * invited_emails. It does NOT sign anyone in and does not send anything — the
 * client hands off to the existing OTP path (`requestSignInLink`), which is
 * itself oracle-free and unchanged. Redemption is a writer to the allowlist; the
 * gate that reads that list was not touched.
 *
 * Body: { token, email, company? }
 *   - token    32 lowercase hex characters after trimming/lowering
 *   - email    validated here for a decent message and AGAIN in the database,
 *              which is the check that counts
 *   - company  honeypot — a visually-hidden field real people leave empty
 *
 * No `runtime` export: pinning "nodejs" is incompatible with cacheComponents
 * (next.config), and Supabase is reached over fetch, so the default is fine.
 */

/**
 * Failure CODES, not sentences. The client owns the wording so en and es stay at
 * parity in one place; a hardcoded English string here would be a third copy
 * that no translator ever sees.
 *
 * There are exactly two codes, and "rate_limited" is not an oracle: it describes
 * this connection, not this token. Every question about the TOKEN — unknown,
 * expired, exhausted, revoked, or never valid — collapses into `refused`.
 */
const REFUSED = "refused";
const RATE_LIMITED = "rate_limited";

/** Tighter than the pledge route's six: a card holder redeems once, not often. */
const MAX_ATTEMPTS = 5;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: REFUSED }, { status: 400 });
  }
  const d = (body ?? {}) as Record<string, unknown>;

  // Honeypot first — BEFORE the rate limit, so bot traffic cannot burn through a
  // shared NAT's budget and lock out the real neighbors behind it. A caught bot
  // is told nothing: it gets the same refusal as a bad code, not a "caught you".
  if (typeof d.company === "string" && d.company.trim() !== "") {
    return NextResponse.json({ ok: false, error: REFUSED }, { status: 400 });
  }

  const token = normalizeToken(d.token);
  const email = normalizeInviteEmail(d.email);

  // Keyed on IP ALONE, not (IP, token). Keying per token would hand an attacker
  // a fresh budget for every guess — the opposite of what the limit is for. A
  // household redeeming two or three cards from one connection stays inside 5.
  if (rateLimited(`invite:${clientIp(request)}`, MAX_ATTEMPTS)) {
    return NextResponse.json({ ok: false, error: RATE_LIMITED }, { status: 429 });
  }

  // A malformed token or address is refused with the same words as a revoked
  // one. The shape check exists to avoid a pointless round trip, not to tell the
  // caller which half they got wrong.
  if (!token || !email) {
    return NextResponse.json({ ok: false, error: REFUSED }, { status: 400 });
  }

  const redeemed = await redeemInvite(token, email);
  if (!redeemed) {
    return NextResponse.json({ ok: false, error: REFUSED }, { status: 400 });
  }

  // The address is on the allowlist. The client now calls the ordinary sign-in
  // action, which sends the code — this route never sends and never signs in.
  return NextResponse.json({ ok: true });
}
