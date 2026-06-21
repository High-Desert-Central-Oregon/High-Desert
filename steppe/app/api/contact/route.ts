import { NextResponse } from "next/server";
import { sendContactEmail } from "@/lib/contact";

/**
 * Public contact endpoint (the /contact form posts here). Validates input, drops
 * honeypot + rate-limited submissions, and delivers via the provider-isolated
 * sendContactEmail(). Email-only: nothing is written to Supabase. On failure it
 * returns a clean error so the UI can fall back to the mailto: link.
 */
export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TOPICS = new Set([
  "General question",
  "Partnership or funding",
  "Press or media",
  "Privacy",
  "Something else",
]);

// Best-effort in-memory rate limit (per serverless instance; resets on cold
// start). A real durable limiter would need shared storage — fine for a low-volume
// contact form, and the honeypot catches most bots first.
const WINDOW_MS = 10 * 60_000;
const MAX_PER_WINDOW = 4;
const hits = new Map<string, number[]>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > MAX_PER_WINDOW;
}

function bad(error: string) {
  return NextResponse.json({ ok: false, error }, { status: 400 });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return bad("Invalid request.");
  }
  const d = (body ?? {}) as Record<string, unknown>;

  // Honeypot: a real person never fills this. Pretend success, send nothing.
  if (typeof d.company === "string" && d.company.trim() !== "") {
    return NextResponse.json({ ok: true });
  }

  const name = typeof d.name === "string" ? d.name.trim() : "";
  const email = typeof d.email === "string" ? d.email.trim().toLowerCase() : "";
  const topicRaw = typeof d.topic === "string" ? d.topic.trim() : "";
  const message = typeof d.message === "string" ? d.message.trim() : "";

  if (!name || name.length > 120) return bad("Please enter your name.");
  if (!EMAIL_RE.test(email) || email.length > 320)
    return bad("Please enter a valid email address.");
  if (!message || message.length > 5000)
    return bad("Please enter a message (up to 5000 characters).");
  const topic = TOPICS.has(topicRaw) ? topicRaw : "General question";

  const ip =
    (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() ||
    "unknown";
  if (rateLimited(ip)) {
    return NextResponse.json(
      { ok: false, error: "Too many messages just now. Please try again in a little while." },
      { status: 429 },
    );
  }

  const result = await sendContactEmail({ name, email, topic, message });
  if (!result.ok) {
    // config (not set up yet) → 503; send failure → 502. Either way the UI shows
    // the error and the mailto: fallback.
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: result.code === "config" ? 503 : 502 },
    );
  }
  return NextResponse.json({ ok: true });
}
