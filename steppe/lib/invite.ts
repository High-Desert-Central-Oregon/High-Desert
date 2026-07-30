import { createAdminClient } from "@/lib/supabase/admin";
import { durableOrigin } from "@/lib/site-url";

/**
 * Invite tokens — the server side of migration 0027.
 *
 * WHAT THIS IS NOT. Redemption is a WRITER to the signup allowlist, never a
 * second signup gate. `enforce_invited_signup()` still asks one question of one
 * table — "is this email on invited_emails" — and knows nothing about tokens
 * (0027's central property). Everything here either puts an address on that list
 * or reads the roster of tokens; nothing here decides who may create an account.
 *
 * WHY THE SERVICE ROLE. `redeem_invite()` is granted to `service_role` alone,
 * with EXECUTE revoked from PUBLIC and from anon (0027, G-INV-4). The person
 * redeeming is anonymous and has no session, so the write cannot be authorised
 * as them — but an anonymous PERSON does not imply an anonymous DATABASE ROLE.
 * With an anon grant, PostgREST would hand the RPC to anyone holding the
 * publishable key, and a printed token is meant to be photographed: a holder
 * could exhaust a 25-use cap with scripted garbage addresses before one real
 * neighbor arrived. Because the grant stops at service_role, the route handler
 * is the only door and its rate limit actually binds.
 *
 * SERVER-SIDE ONLY. Not marked with the `server-only` package — this project does
 * not depend on it — so the discipline is the same one lib/pledge-shared.ts
 * exists to enforce: no client component may import this module. Only the route
 * handler and server components do, and `redeemInvite` would throw at
 * `createAdminClient()` in a browser bundle rather than leak anything, because
 * the secret key is not a NEXT_PUBLIC_ variable.
 *
 * Minting and revoking are deliberately NOT here. They run as the moderator
 * through the ordinary authenticated client under RLS (ADR §4), so they live in
 * app/protected/invites/actions.ts where the session is. Reaching for the admin
 * client there would put the mint path outside the row-level rules every other
 * moderator action obeys.
 */

/** 128 bits of gen_random_bytes, hex-encoded — 32 lowercase hex characters. */
const TOKEN_RE = /^[0-9a-f]{32}$/;

/**
 * Normalize a token the way the database does: lowered and trimmed. Cards are
 * read aloud and retyped, so a token that arrives as "  4F2A… " is the same
 * token. Hex was chosen for exactly this reason (0027) — no case to preserve and
 * no +/- vs /_ to distinguish.
 *
 * Returns "" for anything that is not the right shape. A caller must treat that
 * as an ordinary failure and NOT as a distinguishable answer: see the route.
 */
export function normalizeToken(value: unknown): string {
  if (typeof value !== "string") return "";
  const v = value.trim().toLowerCase();
  return TOKEN_RE.test(v) ? v : "";
}

/** The same permissive shape check the database applies. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeInviteEmail(value: unknown): string {
  if (typeof value !== "string") return "";
  const v = value.trim().toLowerCase();
  return v.length <= 320 && EMAIL_RE.test(v) ? v : "";
}

/**
 * Put one address on the allowlist by redeeming a token. Returns true only if
 * the address is now invited.
 *
 * FAILS CLOSED, AND SILENTLY. Unknown token, expired, exhausted, revoked,
 * malformed address, and a misconfigured admin client all return `false` — the
 * same `false`, with no reason attached. That is the database's contract
 * (redeem_invite has no oracle) and this must not add one back by widening the
 * return type. If it ever needs to distinguish outcomes for an operator, log
 * server-side; never return it.
 *
 * IDEMPOTENT per (token, address): the composite primary key on
 * invite_redemptions is the mutex, so a double-tapped button is a success that
 * burns no second use.
 */
export async function redeemInvite(
  token: string,
  email: string,
): Promise<boolean> {
  if (!token || !email) return false;
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("redeem_invite", {
      p_token: token,
      p_email: email,
    });
    if (error) {
      // A transport or configuration failure, not a refusal. Worth an operator's
      // attention; still indistinguishable to the caller.
      console.error("[invite] redeem_invite failed", error.message);
      return false;
    }
    return data === true;
  } catch (e) {
    console.error("[invite] admin client unavailable for redemption", e);
    return false;
  }
}

/**
 * The URL to print on a card. durableOrigin(), not siteOrigin(): a printed URL
 * outlives every deployment that could have generated it, and a preview host in
 * ink cannot be recalled. This is the same rule that a pledge confirmation email
 * learned the hard way (lib/site-url).
 */
export function inviteUrl(token: string): string {
  return `${durableOrigin()}/invite/${token}`;
}

/** Path only — for in-app links, where the origin is implied. */
export function invitePath(token: string): string {
  return `/invite/${token}`;
}
