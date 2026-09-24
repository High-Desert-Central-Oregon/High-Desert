import { NextResponse } from "next/server";
import { getMyProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { rateLimited } from "@/lib/rate-limit";
import {
  photonLocations,
  type LocationSuggestion,
} from "@/lib/event-locations";

export async function POST(request: Request) {
  const profile = await getMyProfile();
  const respond = (data: unknown, status = 200) =>
    NextResponse.json(data, {
      status,
      headers: { "Cache-Control": "private, no-store" },
    });
  if (!profile?.verified) return respond({ suggestions: [] }, 403);
  if (rateLimited(`locations:${profile.id}`, 120))
    return respond({ suggestions: [], unavailable: true }, 429);
  let q: string;
  try {
    const body = await request.json();
    q = typeof body.q === "string" ? body.q.trim() : "";
  } catch {
    return respond({ suggestions: [] }, 400);
  }
  if (q.length < 3 || q.length > 200) return respond({ suggestions: [] }, 400);
  const db = await createClient();
  // RLS and moderation filtering prevent suggestions from exposing private boards.
  const [events, moderation] = await Promise.all([
    db
      .from("events")
      .select("id,location")
      .ilike("location", `%${q.replace(/[%_\\]/g, "")}%`)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(20),
    db
      .from("content_moderation")
      .select("target_id")
      .eq("target_type", "event")
      .eq("action", "remove"),
  ]);
  const hidden = new Set((moderation.data ?? []).map((r) => r.target_id));
  const rows = events.error || moderation.error ? [] : events.data;
  const suggestions: LocationSuggestion[] = [
    ...new Set(
      (rows ?? [])
        .filter((r) => !hidden.has(r.id))
        .map((r) => r.location as string)
        .filter(Boolean),
    ),
  ]
    .slice(0, 4)
    .map((value) => ({ name: value, address: "", value, source: "steppe" }));
  let unavailable = false;
  try {
    const url = new URL("https://photon.komoot.io/api/");
    url.search = new URLSearchParams({
      q,
      limit: "6",
      lat: "44.2726",
      lon: "-121.1739",
      lang: "en",
    }).toString();
    // Only the typed place query leaves Steppe, never identity, cookies or a device location.
    const result = await fetch(url, {
      signal: AbortSignal.timeout(3500),
      cache: "no-store",
    });
    if (!result.ok) throw new Error("Location service unavailable");
    suggestions.push(...photonLocations(await result.json()));
  } catch {
    unavailable = true;
  }
  return respond({
    suggestions: suggestions.filter(
      (s, i, all) => all.findIndex((v) => v.value === s.value) === i,
    ),
    unavailable,
  });
}
