import { randomUUID } from "node:crypto";

/** Server-only cron health. Never send report content, identifiers, or exceptions. */
export async function startMaintenanceCheckIn() {
  const configured = process.env.SENTRY_BUG_REPORT_CRON_URL;
  if (!configured || process.env.VERCEL_ENV !== "production") return null;
  const id = randomUUID();
  async function checkIn(status: "in_progress" | "ok" | "error") {
    try {
      const url = new URL(configured!);
      if (
        url.protocol !== "https:" ||
        !/^o\d+\.ingest(?:\.[a-z]+)?\.sentry\.io$/.test(url.hostname) ||
        url.username || url.password || url.port ||
        !/^\/api\/\d+\/cron\/[a-zA-Z0-9_-]+\/[a-f0-9]+\/$/.test(url.pathname)
      ) throw new Error("invalid monitor URL");
      url.search = "";
      url.hash = "";
      url.searchParams.set("check_in_id", id);
      url.searchParams.set("environment", "production");
      url.searchParams.set("status", status);
      const response = await fetch(url, {
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(3_000),
      });
      if (!response.ok) throw new Error("check-in rejected");
      await response.body?.cancel();
    } catch {
      // An unavailable monitor must not stop retention or email retries. A lost
      // completion/start will become a timed-out/missed run in Sentry.
      console.error("Bug-report maintenance monitor check-in failed");
    }
  }
  await checkIn("in_progress");
  return { finish: (ok: boolean) => checkIn(ok ? "ok" : "error") };
}
