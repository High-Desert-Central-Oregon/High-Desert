import { NextResponse } from "next/server";
import { clientIp, rateLimited, removePledge } from "@/lib/pledge";

/**
 * Remove a pledge (the confirmation page at /n/[slug]/leave posts here).
 *
 * A hard delete — nothing is retained. No tombstone, no suppression flag, no
 * "unsubscribed" row: verify-then-forget applied to pre-member data. If the
 * same person pledges again later, that is a fresh row and Steppe holds no
 * memory that they ever left.
 *
 * WHY POST AND NOT A LINK THE EMAIL CAN BE CLICKED STRAIGHT INTO: mail clients,
 * security scanners, and link previewers fetch URLs in the background. A GET
 * that deletes would silently unsubscribe people who never touched the link.
 * The emailed link opens a page; the page's button posts here.
 *
 * Body: { token } — a removal token. The token is the whole credential (same
 * posture as the calendar feed token, migration 0020), and it addresses exactly
 * one row by unique index.
 *
 * Always reports success for a well-formed request, whether or not a row
 * existed. A response that distinguished "removed" from "no such token" would
 * turn this into an oracle for testing guessed tokens; `removed` is reported
 * only so the page can word itself naturally, and is identical for an already-
 * removed pledge (both false) — there is nothing to learn from it.
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }
  const d = (body ?? {}) as Record<string, unknown>;
  const token = typeof d.token === "string" ? d.token.trim() : "";

  if (!UUID_RE.test(token)) {
    return NextResponse.json(
      { ok: false, error: "That removal link isn't valid." },
      { status: 400 },
    );
  }

  // A guessed token is infeasible (122 random bits), but a limit costs nothing
  // and keeps a scripted sweep from generating load.
  if (rateLimited(`remove:${clientIp(request)}`)) {
    return NextResponse.json(
      { ok: false, error: "Too many requests just now. Please try again shortly." },
      { status: 429 },
    );
  }

  const removed = await removePledge(token);
  return NextResponse.json({ ok: true, removed });
}
