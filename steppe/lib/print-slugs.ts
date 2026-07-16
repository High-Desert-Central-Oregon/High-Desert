import { NextResponse } from "next/server";

/**
 * Printed QR / poster slugs — THE single place every print destination lives.
 *
 * Each key is a one-letter route (app/<slug>/route.ts) printed on physical
 * material. The printed code points at its slug FOREVER; only the destination
 * here ever changes, so people can be moved somewhere new (e.g. the app-download
 * page at full launch) without a reprint. Never change or remove a slug that has
 * been printed — repoint it.
 *
 * Mechanism (shared by all printed slugs):
 *   • TEMPORARY redirect (307) + Cache-Control: no-store — ON PURPOSE. A
 *     301/308/cacheable response would be pinned by browsers and QR scanners and
 *     fight us when a destination is repointed.
 *   • The destination is resolved against request.url, so the redirect stays on
 *     whatever host was hit (preserves www; no hardcoded origin).
 *   • No logging, no request metadata read. Printed slugs carry utm_content because
 *     the /join page's first-party, zero-PII qr_counts counter keys on it. The
 *     labels are campaign/content names only; counts stay aggregate by day.
 *
 * Adding a slug: add it here, create the two-line app/<slug>/route.ts, and add
 * the path to the public allowlist in lib/supabase/proxy.ts (so it works even in
 * a prelaunch phase).
 */
export const PRINT_SLUGS = {
  q: "/join?utm_source=qr&utm_medium=card&utm_content=quiet", // business card, "quiet"
  p: "/join?utm_source=qr&utm_medium=card&utm_content=square", // business card, "square"
  d: "/join?utm_source=qr&utm_medium=poster&utm_content=poster_owned", // poster, "Owned by the people who live here."
  e: "/join?utm_source=qr&utm_medium=poster&utm_content=poster_built", // poster, "Built here. Owned here."
  c: "/join?utm_source=qr&utm_medium=poster&utm_content=poster_common", // poster, "Common ground."
  s: "/join?utm_source=qr&utm_medium=seed-card&utm_content=seed_card", // compass seed card
} as const;

export type PrintSlug = keyof typeof PRINT_SLUGS;

/** The shared redirect: temporary (307), never cached, host-preserving. */
export function printRedirect(slug: PrintSlug, request: Request): NextResponse {
  const dest = new URL(PRINT_SLUGS[slug], request.url);
  const res = NextResponse.redirect(dest, 307);
  res.headers.set("Cache-Control", "no-store");
  return res;
}
