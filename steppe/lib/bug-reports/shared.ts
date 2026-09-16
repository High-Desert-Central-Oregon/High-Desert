import {
  sanitizeSentryReferences,
  type SentryReference,
} from "./sentry-references";
/** Only these technical event names and route templates may leave the device. */
export const EVENT_NAMES = [
  "page.open",
  "form.submit",
  "ui.error",
  "client.error",
  "client.rejection",
  "network.offline",
  "network.online",
  "verification.upload",
  "verification.upload_failed",
  "verification.saved",
  "verification.save_failed",
  "rsvp.saved",
  "rsvp.failed",
] as const;
export type EventName = (typeof EVENT_NAMES)[number];
export type DiagnosticEvent = { atMs: number; name: EventName; page: string };
export const MAX_EVENTS = 100;
export const MAX_AGE_MS = 10 * 60_000;
export const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATIC_PAGES = new Set([
  "/",
  "/join",
  "/contact",
  "/privacy",
  "/partners",
  "/preview",
  "/welcome",
  "/invite",
  "/auth/login",
  "/auth/sign-up",
  "/auth/confirm",
  "/auth/error",
  "/legal/privacy",
  "/legal/terms",
  "/protected",
  "/protected/account",
  "/protected/account/profile",
  "/protected/account/calendar",
  "/protected/verify",
  "/protected/review",
  "/protected/invites",
  "/protected/moderation",
  "/protected/exchange",
  "/protected/exchange/new",
  "/protected/exchange/upcoming",
  "/protected/events",
  "/protected/events/new",
  "/protected/groups",
  "/protected/groups/new",
  "/protected/governance",
  "/protected/governance/new",
  "/protected/governance/record",
  "/protected/messages",
  "/protected/neighborhoods",
  "/protected/support",
  "/protected/work",
  "/protected/people",
  "/protected/activity",
  "/protected/help",
  "/protected/account/sign-in-methods",
  "/auth/callback",
  "/protected/transparency",
]);
const TEMPLATES = [
  "/invite/[token]",
  "/cal/[token]",
  "/n/[slug]",
  "/n/[slug]/leave",
  "/protected/events/[id]",
  "/protected/exchange/[id]",
  "/protected/groups/[slug]",
  "/protected/groups/[slug]/manage",
  "/protected/governance/[id]",
  "/protected/messages/[id]",
  "/protected/support/[id]",
  "/protected/review/[id]",
];
export function safePage(value: unknown): string {
  if (typeof value !== "string") return "/unknown";
  const path = value.split(/[?#]/, 1)[0].replace(/\/$/, "") || "/";
  if (STATIC_PAGES.has(path) || TEMPLATES.includes(path)) return path;
  if (/^\/(invite|cal)\/[^/]+$/.test(path))
    return `/${path.split("/")[1]}/[token]`;
  if (/^\/n\/[^/]+(?:\/leave)?$/.test(path))
    return path.endsWith("/leave") ? "/n/[slug]/leave" : "/n/[slug]";
  const match = path.match(
    /^\/protected\/(events|exchange|groups|governance|messages|support|review)\/[^/]+(\/manage)?$/,
  );
  if (match && (!match[2] || match[1] === "groups"))
    return `/protected/${match[1]}/${match[1] === "groups" ? "[slug]" : "[id]"}${match[2] ?? ""}`;
  return "/unknown";
}
export type Environment = {
  release: string;
  browser: string;
  version: string;
  os: string;
  width: number;
  height: number;
  locale: "en" | "es";
  mode: "browser" | "installed";
  online: boolean;
};
export type Diagnostics = {
  events: DiagnosticEvent[];
  environment: Environment;
  sentryErrors?: SentryReference[];
};
export function sanitizeDiagnostics(value: unknown): Diagnostics | null {
  if (!value || typeof value !== "object") return null;
  const d = value as Record<string, unknown>;
  const rawEnv =
    d.environment && typeof d.environment === "object"
      ? (d.environment as Record<string, unknown>)
      : {};
  const choose = (value: unknown, values: string[]) =>
    typeof value === "string" && values.includes(value) ? value : "unknown";
  const dimension = (v: unknown) =>
    typeof v === "number" && Number.isFinite(v)
      ? Math.max(0, Math.min(10000, Math.round(v)))
      : 0;
  const events = (Array.isArray(d.events) ? d.events : [])
    .slice(-MAX_EVENTS)
    .flatMap((value): DiagnosticEvent[] => {
      if (!value || typeof value !== "object") return [];
      const event = value as Record<string, unknown>;
      if (
        !EVENT_NAMES.includes(event.name as EventName) ||
        typeof event.atMs !== "number" ||
        !Number.isFinite(event.atMs) ||
        event.atMs < 0 ||
        event.atMs > MAX_AGE_MS
      )
        return [];
      return [
        {
          atMs: Math.round(event.atMs),
          name: event.name as EventName,
          page: safePage(event.page),
        },
      ];
    })
    .sort((a, b) => a.atMs - b.atMs);
  return {
    events,
    ...(Array.isArray(d.sentryErrors)
      ? { sentryErrors: sanitizeSentryReferences(d.sentryErrors) }
      : {}),
    environment: {
      release:
        typeof rawEnv.release === "string" &&
        /^[a-zA-Z0-9._-]{1,80}$/.test(rawEnv.release)
          ? rawEnv.release
          : "unknown",
      browser: choose(rawEnv.browser, ["Chrome", "Edge", "Firefox", "Safari"]),
      version:
        typeof rawEnv.version === "string" &&
        /^\d{1,4}(?:\.\d{1,6}){0,3}$/.test(rawEnv.version)
          ? rawEnv.version
          : "unknown",
      os: choose(rawEnv.os, ["Android", "iOS", "macOS", "Windows", "Linux"]),
      width: dimension(rawEnv.width),
      height: dimension(rawEnv.height),
      locale: rawEnv.locale === "es" ? "es" : "en",
      mode: rawEnv.mode === "installed" ? "installed" : "browser",
      online: rawEnv.online === true,
    },
  };
}
export type ReportInput = {
  requestKey: string;
  description: string;
  expected: string;
  email: string;
  page: string;
  locale: "en" | "es";
  diagnostics: Diagnostics | null;
};
export function parseReport(value: unknown): ReportInput | null {
  if (!value || typeof value !== "object") return null;
  const d = value as Record<string, unknown>;
  if (typeof d.requestKey !== "string" || !UUID.test(d.requestKey)) return null;
  if (
    typeof d.description !== "string" ||
    d.description.trim().length < 5 ||
    d.description.length > 4000
  )
    return null;
  if (
    typeof d.expected !== "string" ||
    d.expected.length > 2000 ||
    typeof d.email !== "string" ||
    d.email.length > 320
  )
    return null;
  const email = d.email.trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return {
    requestKey: d.requestKey,
    description: d.description.trim(),
    expected: d.expected.trim(),
    email,
    page: safePage(d.page),
    locale: d.locale === "es" ? "es" : "en",
    diagnostics: sanitizeDiagnostics(d.diagnostics),
  };
}

/** Opt-in, bounded memory only. No persistent storage or user content. */
export class DiagnosticBuffer {
  private enabled = false;
  private events: { time: number; name: EventName; page: string }[] = [];
  enable(value: boolean) {
    this.enabled = value;
    this.events = [];
  }
  isEnabled() {
    return this.enabled;
  }
  record(name: EventName, page: string, now = Date.now()) {
    if (!this.enabled || !EVENT_NAMES.includes(name)) return;
    this.events = this.events
      .filter((e) => now - e.time <= MAX_AGE_MS)
      .slice(-(MAX_EVENTS - 1));
    this.events.push({ time: now, name, page: safePage(page) });
  }
  snapshot(now = Date.now()): DiagnosticEvent[] {
    this.events = this.events.filter((e) => now - e.time <= MAX_AGE_MS);
    const first = this.events[0]?.time ?? now;
    return this.events.map((e) => ({
      atMs: e.time - first,
      name: e.name,
      page: e.page,
    }));
  }
}
