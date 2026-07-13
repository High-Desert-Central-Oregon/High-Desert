import { describe, expect, it } from "vitest";
import {
  buildIcs,
  foldIcsLine,
  icsEscapeText,
  icsUtcStamp,
} from "@/lib/ics";

// Pure-function tests — no DB, always run.

describe("icsEscapeText (RFC 5545 §3.3.11)", () => {
  it("escapes backslash, semicolon, comma, and newlines", () => {
    expect(icsEscapeText("a\\b;c,d\ne\r\nf")).toBe("a\\\\b\\;c\\,d\\ne\\nf");
  });

  it("escapes backslash before the others (no double-escaping)", () => {
    expect(icsEscapeText("\\;")).toBe("\\\\\\;");
  });
});

describe("icsUtcStamp", () => {
  it("renders UTC basic format", () => {
    expect(icsUtcStamp("2026-07-23T17:00:00.000Z")).toBe("20260723T170000Z");
    expect(icsUtcStamp("2026-07-23T10:00:00-07:00")).toMatch(
      /^\d{8}T\d{6}Z$/,
    );
  });
});

describe("foldIcsLine (RFC 5545 §3.1)", () => {
  const octets = (s: string) => new TextEncoder().encode(s).length;

  it("leaves short lines alone", () => {
    expect(foldIcsLine("SUMMARY:short")).toBe("SUMMARY:short");
  });

  it("folds long lines so no physical line exceeds 75 octets", () => {
    const folded = foldIcsLine("SUMMARY:" + "x".repeat(300));
    for (const line of folded.split("\r\n")) {
      expect(octets(line)).toBeLessThanOrEqual(75);
    }
  });

  it("unfolding restores the original content", () => {
    const original = "DESCRIPTION:" + "palabra ".repeat(40);
    expect(foldIcsLine(original).replace(/\r\n /g, "")).toBe(original);
  });

  it("never splits a multi-byte character", () => {
    // 72 ASCII octets then a 2-octet character straddling the 75 boundary.
    const original = "SUMMARY:" + "a".repeat(64) + "ééé" + "b".repeat(40);
    const folded = foldIcsLine(original);
    for (const line of folded.split("\r\n")) {
      expect(octets(line)).toBeLessThanOrEqual(75);
    }
    expect(folded.replace(/\r\n /g, "")).toBe(original);
  });
});

describe("buildIcs", () => {
  const base = {
    uid: "abc@steppe.community",
    dtstamp: "2026-07-01T00:00:00.000Z",
    dtstart: "2026-07-23T17:00:00.000Z",
    summary: "Vendor Market, opening day; bring a bag",
    location: "7th & Evergreen, Redmond",
  };

  it("escapes member text and keeps structure", () => {
    const ics = buildIcs({ events: [base] });
    expect(ics).toContain("SUMMARY:Vendor Market\\, opening day\\; bring a bag");
    expect(ics).toContain("LOCATION:7th & Evergreen\\, Redmond");
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR")).toBe(true);
  });

  it("omits DTEND when absent, emits it when present", () => {
    expect(buildIcs({ events: [base] })).not.toContain("DTEND");
    expect(
      buildIcs({
        events: [{ ...base, dtend: "2026-07-23T19:00:00.000Z" }],
      }),
    ).toContain("DTEND:20260723T190000Z");
  });

  it("marks cancelled events so subscribed apps update", () => {
    expect(buildIcs({ events: [{ ...base, cancelled: true }] })).toContain(
      "STATUS:CANCELLED",
    );
    expect(buildIcs({ events: [base] })).not.toContain("STATUS:CANCELLED");
  });

  it("names subscription feeds and advertises the poll hint", () => {
    const ics = buildIcs({
      events: [base],
      calName: "Steppe — My calendar · Mi calendario",
      refreshTtl: "PT1H",
    });
    expect(ics).toContain("X-WR-CALNAME:Steppe — My calendar · Mi calendario");
    expect(ics).toContain("REFRESH-INTERVAL;VALUE=DURATION:PT1H");
    expect(ics).toContain("X-PUBLISHED-TTL:PT1H");
  });
});
