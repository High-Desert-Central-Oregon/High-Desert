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
 * SERVER ONLY — it imports next/headers transitively. The types and the count
 * arithmetic live in lib/pledge-shared.ts so the client panel can use them
 * without dragging a database client into the browser bundle; everything there
 * is re-exported here, so server callers still have a single import.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { siteOrigin } from "@/lib/site-url";
import {
  normalizeEmail,
  normalizeSlug,
  isEmailShaped,
  pledgePath,
  type NeighborhoodStatus,
} from "@/lib/pledge-shared";

export * from "@/lib/pledge-shared";

// --- the two absolute URLs that appear in email ------------------------------
// Built from siteOrigin() rather than hardcoded, so preview deploys are
// self-referential. In production this resolves to the canonical origin, which
// is what the printed steppe.community/n/<slug> redirects to. Server-side only:
// siteOrigin() reads VERCEL_URL, which is not a NEXT_PUBLIC_ variable.

/** The neighborhood's public page — what a pledger forwards to three doors. */
export function pledgeShareUrl(slug: string): string {
  return `${siteOrigin()}${pledgePath(slug)}`;
}

/**
 * The token-bearing removal link. Points at a confirmation PAGE, never at an
 * endpoint that deletes on GET — mail scanners and link previewers fetch URLs in
 * the background and would otherwise unsubscribe people who never clicked.
 */
export function pledgeRemovalUrl(slug: string, token: string): string {
  return `${siteOrigin()}${pledgePath(slug)}/leave?token=${encodeURIComponent(token)}`;
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

/**
 * EXACTLY what submit_pledge() returns — four columns, no slug and no name.
 * That narrowness is deliberate (the function hands back public facts and
 * nothing else), so this type has to say so. It previously reused the wider
 * status row, which asserted a `name` the database never sends: the cast
 * compiled, `name` was undefined at runtime, and the confirmation email went
 * out reading "is now at 1 of 20." with the neighborhood silently missing.
 * Keep this shape in step with the SQL and that class of bug cannot compile.
 */
type SubmitRow = {
  pledge_count: number;
  threshold: number;
  is_open: boolean;
  already_pledged: boolean;
};

/** The four facts a submission reports back. Deliberately no slug, no name. */
export type PledgeOutcome = {
  pledgeCount: number;
  threshold: number;
  isOpen: boolean;
  alreadyPledged: boolean;
};

export type SubmitOutcome =
  | { ok: true; result: PledgeOutcome }
  | { ok: false; reason: "invalid_email" | "unknown_neighborhood" | "error" };

/**
 * Record one pledge. Idempotent per (neighborhood, address): a repeat submission
 * returns the same count with `alreadyPledged: true` and, crucially, does not
 * inflate the number or re-send the confirmation.
 *
 * Never returns the row, the id, or the removal token — the database function's
 * return type is the contract, so none of those can ride along by accident. A
 * caller that needs the neighborhood's display name must ask for it separately
 * (getNeighborhoodStatus); it is not in this result.
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
    .maybeSingle<SubmitRow>();

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
    result: {
      // count(*) is bigint; supabase-js may hand it back as a string.
      pledgeCount: Number(data.pledge_count),
      threshold: data.threshold,
      isOpen: data.is_open,
      alreadyPledged: data.already_pledged,
    },
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
