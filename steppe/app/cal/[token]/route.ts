import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildIcs, type IcsEvent } from "@/lib/ics";
import { siteOrigin } from "@/lib/site-url";

/**
 * Calendar subscription feed (calendar-c1-spec §6) — the public GET calendar
 * apps poll. The token in the path is the entire credential (a member-minted
 * bearer capability; apps send no auth headers), so this route is
 * deliberately anon-reachable and deliberately thin:
 *
 *   shape-check → calendar_feed_payload() via the service-role client →
 *   404 or ICS.
 *
 * ALL authorization lives in the RPC (migration 0020): it is executable by
 * service_role only — this route is its single caller — and it re-derives
 * the owner's standing on every serve, so feeds fail closed on revocation,
 * rotation, group-leave, unverification, archival, and account deletion.
 * Absent, revoked, and dead feeds are all the same bare 404 — no revocation
 * oracle. The payload is minimized at the source (titles/times/places only;
 * no names, no bodies, no RSVP data); this route adds nothing but ICS
 * framing. Malformed tokens 404 without a database round trip.
 */

// Feeds are polled by apps, not read in a member's locale, so the DESCRIPTION
// ships the spec's fixed EN string (spec §2 calendar.icsFeedDescription —
// deliberately not a dictionary key; there is no locale on this request).
const FEED_DESCRIPTION =
  "A Steppe community calendar. Details and RSVPs live inside Steppe.";

type FeedEvent = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string | null;
  location: string | null;
  status: string;
  created_at: string;
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token: raw } = await params;
  // Accept an optional .ics suffix (some calendar apps and members expect it).
  const token = raw.endsWith(".ics") ? raw.slice(0, -4) : raw;
  if (!/^[0-9a-f]{64}$/.test(token)) {
    return new NextResponse(null, { status: 404 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("calendar_feed_payload", {
    p_token: token,
  });
  if (error || !data || data.ok !== true) {
    return new NextResponse(null, { status: 404 });
  }

  const origin = siteOrigin();
  const events = ((data.events ?? []) as FeedEvent[]).map(
    (e): IcsEvent => ({
      uid: `${e.id}@steppe.community`,
      dtstamp: e.created_at,
      dtstart: e.starts_at,
      dtend: e.ends_at,
      summary: e.title,
      location: e.location,
      // Tap-through lands on login → the event detail, inside the membrane.
      url: `${origin}/protected/events/${e.id}`,
      description: FEED_DESCRIPTION,
      cancelled: e.status === "cancelled",
    }),
  );

  const ics = buildIcs({
    calName: data.cal_name as string,
    refreshTtl: "PT1H",
    events,
  });

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="steppe.ics"',
      // Private member data behind a capability — never cache-shared.
      "Cache-Control": "no-store, private",
    },
  });
}
