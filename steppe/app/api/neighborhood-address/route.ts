import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { rateLimited } from "@/lib/rate-limit";
import { readLimitedJson } from "@/lib/limited-json";
import {
  photonAddresses,
  REDMOND_SEARCH_BOX,
} from "@/lib/neighborhood-address";

export async function POST(request: Request) {
  const respond = (data: unknown, status = 200) =>
    NextResponse.json(data, {
      status,
      headers: { "Cache-Control": "private, no-store" },
    });
  // Neighborhood selection also serves new members before residency verification.
  const user = await getCurrentUser();
  if (!user) return respond({ results: [] }, 401);
  if (rateLimited(`neighborhood-address:${user.id}`, 30))
    return respond({ results: [], unavailable: true }, 429);
  let q: string;
  let locale: string;
  try {
    const input = (await readLimitedJson(request, 1024)) as {
      q?: unknown;
      locale?: unknown;
    } | null;
    q = typeof input?.q === "string" ? input.q.trim() : "";
    locale = input?.locale === "es" ? "es" : "en";
  } catch {
    return respond({ results: [] }, 400);
  }
  if (q.length < 3 || q.length > 200) return respond({ results: [] }, 400);
  try {
    const url = new URL("https://photon.komoot.io/api/");
    url.search = new URLSearchParams({
      q,
      limit: "6",
      lat: "44.2726",
      lon: "-121.1739",
      bbox: REDMOND_SEARCH_BOX.join(","),
      lang: locale,
    }).toString();
    // Only the submitted query leaves Steppe. No identity/cookies/device location,
    // logging, database write or automatic neighborhood/verification decision.
    const response = await fetch(url, {
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
    if (!response.ok) return respond({ results: [], unavailable: true }, 503);
    return respond({ results: photonAddresses(await response.json()) });
  } catch {
    return respond({ results: [], unavailable: true }, 503);
  }
}
