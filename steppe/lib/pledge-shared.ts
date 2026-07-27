/**
 * Pledge campaign vocabulary — the types and the count arithmetic, and nothing
 * else.
 *
 * Split out from lib/pledge.ts because that module reaches the database, which
 * means it imports next/headers and can only ever run on the server. The pledge
 * panel is a client component and needs exactly this much: what a status IS, and
 * how to read a count against a threshold. Keeping the two apart is what stops
 * a server-only import from being dragged into the browser bundle by a helper
 * that is three lines of arithmetic.
 *
 * Everything here is pure and safe in either environment. Server callers import
 * lib/pledge.ts, which re-exports all of it, so they still have one import.
 */

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

type Counted = { pledgeCount: number; threshold: number };

/** Threshold met but not yet opened — "we got there, it starts shortly". */
export function thresholdReached(s: Counted): boolean {
  return s.pledgeCount >= s.threshold;
}

/** Households still needed. Never negative. */
export function remaining(s: Counted): number {
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

/**
 * The neighborhood's public path. Printed on mailers, door hangers, and yard
 * signs — a printed URL cannot be changed afterwards, so do not restructure
 * /n/<slug> without reprinting everything already in the field.
 */
export function pledgePath(slug: string): string {
  return `/n/${normalizeSlug(slug)}`;
}
