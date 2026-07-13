import Link from "next/link";
import { cn } from "@/lib/utils";
import { SectionLabel } from "./section-row";
import { DateTileRow } from "./date-tile-row";
import {
  REDMOND_TZ,
  formatRedmondDateTime,
  redmondWallTimeToUtcISO,
} from "@/lib/time";
import type { Dictionary } from "@/lib/i18n";

/**
 * The month view (calendar-c1-spec §1.3) — proposed in-register because the
 * bundle contains no calendar UI: a real <table> of hairline cells (the
 * :882 date tile generalized to a lattice), Besley day numerals (16px, the
 * :887 step), and a SINGLE neutral rust presence dot on days with events —
 * the unread-dot grammar (:2085) under "presence, never a number" (:1518).
 * Never per-category dots: a category marker may not appear without its
 * label (:1493), so category speaks only in the day agenda below. Today is
 * the rust numeral (the active position, :1513); the selected day takes the
 * segStyle-active treatment (bone fill + 2px rust rule).
 *
 * Everything is server-rendered links (?v=month&m=YYYY-MM&d=YYYY-MM-DD) —
 * zero client JS, which answers "a grid is poor on slow phones" at the root.
 * Out-of-month cells are empty; days without events are plain text (only
 * event-days are links). The Redmond clock (REDMOND_TZ) decides which day an
 * event belongs to and which day is "today"; the weekday of a civil date is
 * timezone-free.
 */

export type MonthViewEvent = {
  id: string;
  title: string;
  starts_at: string;
  location: string | null;
  /** Optional extra mono tag for the when-line (e.g. "Maybe"). */
  tag?: string | null;
};

export type MonthRef = { year: number; month: number }; // month 1–12

/** The month navigation window: launch-year −1 through +5 years. */
const MIN_YEAR = 2025;
const MAX_YEAR_AHEAD = 5;

function redmondToday(): string {
  // en-CA renders YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: REDMOND_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Validate/clamp ?m=YYYY-MM; junk or out-of-window renders the clamp, not an error. */
export function monthFromParam(m: string | undefined): MonthRef {
  const today = redmondToday();
  const fallback: MonthRef = {
    year: Number(today.slice(0, 4)),
    month: Number(today.slice(5, 7)),
  };
  const match = m?.match(/^(\d{4})-(\d{2})$/);
  if (!match) return fallback;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return fallback;
  const maxYear = fallback.year + MAX_YEAR_AHEAD;
  if (year < MIN_YEAR) return { year: MIN_YEAR, month: 1 };
  if (year > maxYear) return { year: maxYear, month: 12 };
  return { year, month };
}

/** Validate ?d=YYYY-MM-DD; it must name a real day inside the shown month. */
export function dayFromParam(
  d: string | undefined,
  ref: MonthRef,
): string | null {
  const match = d?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  if (Number(match[1]) !== ref.year || Number(match[2]) !== ref.month)
    return null;
  const day = Number(match[3]);
  if (day < 1 || day > daysIn(ref)) return null;
  return d as string;
}

export function monthKey(ref: MonthRef): string {
  return `${ref.year}-${String(ref.month).padStart(2, "0")}`;
}

function daysIn(ref: MonthRef): number {
  return new Date(Date.UTC(ref.year, ref.month, 0)).getUTCDate();
}

function shift(ref: MonthRef, by: -1 | 1): MonthRef {
  const n = ref.year * 12 + (ref.month - 1) + by;
  return { year: Math.floor(n / 12), month: (n % 12) + 1 };
}

/** UTC query bounds for the shown month — [start, end) in Redmond wall time. */
export function monthBoundsUtc(ref: MonthRef): {
  startIso: string;
  endIso: string;
} {
  // Midnight never falls in a US DST gap (transitions happen at 2 am), so
  // these conversions cannot fail for a validated ref; the UTC fallback is a
  // dead branch kept for type honesty.
  return {
    startIso:
      redmondWallTimeToUtcISO(`${monthKey(ref)}-01T00:00`) ??
      new Date(Date.UTC(ref.year, ref.month - 1, 1)).toISOString(),
    endIso:
      redmondWallTimeToUtcISO(`${monthKey(shift(ref, 1))}-01T00:00`) ??
      new Date(Date.UTC(ref.year, ref.month, 1)).toISOString(),
  };
}

/** Which Redmond day an instant falls on (YYYY-MM-DD). */
export function redmondDayOf(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: REDMOND_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

export function MonthView({
  events,
  locale,
  dict,
  basePath,
  month,
  selectedDay,
}: {
  /** The shown month's events, already scope-filtered by the caller. */
  events: MonthViewEvent[];
  locale: string;
  dict: Dictionary;
  /** The surface's own path; MonthView appends ?v=month&m=…&d=…. */
  basePath: string;
  month: MonthRef;
  selectedDay?: string | null;
}) {
  const href = (m: MonthRef, d?: string) =>
    `${basePath}?v=month&m=${monthKey(m)}${d ? `&d=${d}` : ""}`;

  const today = redmondToday();
  const eventDays = new Set(events.map((e) => redmondDayOf(e.starts_at)));

  const total = daysIn(month);
  // The weekday of a civil date is a timezone-free calendar fact.
  const firstWeekday = new Date(
    Date.UTC(month.year, month.month - 1, 1),
  ).getUTCDay(); // 0 = Sunday
  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: total }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  // Locale weekday heads (Sun-first; 2023-01-01 was a Sunday).
  const weekdayFmt = new Intl.DateTimeFormat(locale, {
    weekday: "short",
    timeZone: "UTC",
  });
  const heads = Array.from({ length: 7 }, (_, i) =>
    weekdayFmt.format(new Date(Date.UTC(2023, 0, 1 + i))).toUpperCase(),
  );

  const monthLabel = new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(month.year, month.month - 1, 1)));

  const dayLabelFmt = new Intl.DateTimeFormat(locale, {
    timeZone: "UTC",
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const fullDayLabel = (dayKey: string) =>
    dayLabelFmt.format(new Date(`${dayKey}T00:00:00Z`));

  const dayKeyOf = (day: number) =>
    `${monthKey(month)}-${String(day).padStart(2, "0")}`;

  const prev = shift(month, -1);
  const next = shift(month, 1);
  const maxYear = Number(today.slice(0, 4)) + MAX_YEAR_AHEAD;
  const canPrev = prev.year >= MIN_YEAR;
  const canNext = next.year <= maxYear;

  const chevron = (path: string) => (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#36563D"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={path} />
    </svg>
  );

  const dayEvents = selectedDay
    ? events
        .filter((e) => redmondDayOf(e.starts_at) === selectedDay)
        .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at))
    : [];

  return (
    <div className="flex flex-col gap-4">
      {/* Month bar — juniper chevrons navigate (bundle :916); the label is
          decoration here, the table caption carries it for screen readers. */}
      <div className="flex items-center justify-between">
        {canPrev ? (
          <Link
            href={href(prev)}
            aria-label={dict.calendar.prevMonth}
            className="p-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {chevron("M15 5l-7 7 7 7")}
          </Link>
        ) : (
          <span className="w-[26px]" />
        )}
        <span
          aria-hidden="true"
          className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground"
        >
          {monthLabel}
        </span>
        {canNext ? (
          <Link
            href={href(next)}
            aria-label={dict.calendar.nextMonth}
            className="p-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {chevron("M9 5l7 7-7 7")}
          </Link>
        ) : (
          <span className="w-[26px]" />
        )}
      </div>

      <table className="w-full table-fixed border-collapse">
        <caption className="sr-only">{monthLabel}</caption>
        <thead>
          <tr>
            {heads.map((h) => (
              <th
                key={h}
                scope="col"
                className="border py-[6px] font-mono text-[8.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week, wi) => (
            <tr key={wi}>
              {week.map((day, di) => {
                if (day === null)
                  return <td key={di} className="border" aria-hidden="true" />;
                const dayKey = dayKeyOf(day);
                const isToday = dayKey === today;
                const hasEvents = eventDays.has(dayKey);
                const isSelected = dayKey === selectedDay;
                const numeral = (
                  <span
                    className={cn(
                      "block font-serif text-[16px] font-semibold leading-none",
                      isToday ? "text-accent" : "text-foreground",
                    )}
                  >
                    {day}
                  </span>
                );
                return (
                  <td
                    key={di}
                    aria-current={isToday ? "date" : undefined}
                    className={cn(
                      "h-[52px] border p-0 text-center align-top",
                      isSelected && "border-b-2 border-b-accent bg-muted",
                    )}
                  >
                    {hasEvents ? (
                      <Link
                        href={href(month, dayKey)}
                        aria-label={`${fullDayLabel(dayKey)} — ${dict.calendar.hasEvents}`}
                        className="flex h-full w-full flex-col items-center pt-[9px] transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                      >
                        {numeral}
                        <span
                          aria-hidden="true"
                          className="mt-[4px] block h-[5px] w-[5px] rounded-full bg-accent"
                        />
                      </Link>
                    ) : (
                      <span className="flex h-full w-full flex-col items-center pt-[9px]">
                        {numeral}
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {/* The day agenda — the tapped day's date-tile rows (the agenda unit;
          category context lives here, never in the grid). */}
      {selectedDay && (
        <section className="flex flex-col gap-1">
          <SectionLabel>{fullDayLabel(selectedDay)}</SectionLabel>
          <ul className="flex flex-col border-t">
            {dayEvents.map((e) => (
              <li key={e.id}>
                <DateTileRow
                  href={`/protected/events/${e.id}`}
                  iso={e.starts_at}
                  locale={locale}
                  title={e.title}
                  when={[
                    formatRedmondDateTime(e.starts_at, locale),
                    e.location,
                    e.tag,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
