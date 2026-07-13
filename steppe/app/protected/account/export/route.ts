import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";

/**
 * Member-owned data export (CLAUDE.md invariant 8 — exportable, member-owned,
 * nothing held hostage). A GET that streams everything THIS member's account
 * holds as one JSON file.
 *
 * RLS-pinned to the acting member: every read uses the member's own session
 * client (so Row-Level Security applies as them) AND filters explicitly to their
 * own id. There is no service-role bypass here and no way to ask for anyone
 * else's data — a hostile caller gets only their own rows, or nothing.
 *
 * Note `votes` returns only the member's OWN ballots (vt_select is own-row only),
 * so exporting them never breaks the secret ballot.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "not signed in" }, { status: 401 });
  }

  const supabase = await createClient();
  const uid = user.id;

  const [
    profile,
    verifications,
    neighborhoodRequests,
    consents,
    events,
    rsvps,
    proposals,
    votes,
    appeals,
    auditLog,
    calendarFeeds,
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
    supabase
      .from("verifications")
      .select("id, method, status, reviewed_at, created_at")
      .eq("user_id", uid),
    supabase.from("neighborhood_requests").select("*").eq("user_id", uid),
    supabase.from("consents").select("*").eq("user_id", uid),
    supabase.from("events").select("*").eq("creator_id", uid),
    supabase.from("event_rsvps").select("*").eq("user_id", uid),
    supabase.from("proposals").select("*").eq("author_id", uid),
    supabase
      .from("votes")
      .select("proposal_id, choice, weight, created_at")
      .eq("user_id", uid), // own ballots only (RLS); never anyone else's
    supabase.from("appeals").select("*").eq("user_id", uid),
    supabase.from("audit_log").select("*").eq("actor_id", uid),
    // Calendar feeds, SANS TOKEN (spec §7.6): the metadata is the member's;
    // the bearer secret stays out of a file that gets saved around. No
    // explicit member filter — member_id isn't even selectable (0020), and
    // cf_read already scopes rows to the owner.
    supabase
      .from("calendar_feeds")
      .select("id, group_id, created_at, rotated_at, last_fetched_at"),
  ]);

  const payload = {
    // UTC instant — machine-readable export metadata, not a Redmond wall-clock
    // display, so it does not route through lib/time.ts.
    exported_at: new Date().toISOString(),
    account: { id: uid, email: user.email },
    note: "Your Steppe data. Verification evidence is never kept — it is deleted the moment a decision is made (verify, then forget).",
    profile: profile.data ?? null,
    verifications: verifications.data ?? [],
    neighborhood_requests: neighborhoodRequests.data ?? [],
    consents: consents.data ?? [],
    events: events.data ?? [],
    event_rsvps: rsvps.data ?? [],
    proposals: proposals.data ?? [],
    votes: votes.data ?? [],
    appeals: appeals.data ?? [],
    audit_log: auditLog.data ?? [],
    calendar_feeds: calendarFeeds.data ?? [],
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="steppe-export.json"',
      "Cache-Control": "no-store",
    },
  });
}
