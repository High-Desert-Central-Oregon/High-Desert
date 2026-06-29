import { NextResponse } from "next/server";

/**
 * /p — permanent, repointable QR target (printed on the business card, "square").
 *
 * The printed code points at /p FOREVER; only the destination below ever changes,
 * so we can move people somewhere new at launch without a reprint. Today it
 * forwards to the pre-launch interest form, tagged so the qr_counts A/B counter on
 * /join records this as the "square" card (utm_content MUST stay "square" — it's
 * the key the scan counter reads).
 *
 * 302 (temporary) + Cache-Control: no-store ON PURPOSE — a 301/permanent or a
 * cacheable response would be pinned by browsers and QR scanners and fight us when
 * we repoint the destination at launch.
 *
 * Destination is built from request.url so the redirect stays on whatever host was
 * hit (preserves www; no hardcoded origin).
 *
 * LAUNCH NOTE: at full launch, change ONLY the destination path here from /join to
 * the app-download page (keep utm_content=square if we still want to know which
 * card drove installs). Never change the route path — the printed code is permanent.
 */
export function GET(request: Request) {
  const dest = new URL(
    "/join?utm_source=qr&utm_medium=card&utm_content=square",
    request.url,
  );
  const res = NextResponse.redirect(dest, 302);
  res.headers.set("Cache-Control", "no-store");
  return res;
}
