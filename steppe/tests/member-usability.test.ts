import { describe, expect, it } from "vitest";
import { redmondWallTimeToUtcISO, redmondInputValue } from "@/lib/time";
import { calendarDetails } from "@/lib/calendar-details";
import { photonLocations } from "@/lib/event-locations";
import { parsePostTags } from "@/lib/post-tags";

describe("Pacific event times", () => {
  it.each([
    ["2026-01-15T18:00", "2026-01-16T02:00:00.000Z"],
    ["2026-07-15T18:00", "2026-07-16T01:00:00.000Z"],
    ["2026-03-08T01:30", "2026-03-08T09:30:00.000Z"],
    ["2026-03-08T03:30", "2026-03-08T10:30:00.000Z"],
    ["2026-11-01T01:30", "2026-11-01T08:30:00.000Z"],
    ["2026-11-01T02:30", "2026-11-01T10:30:00.000Z"],
    ["2026-07-15T00:00", "2026-07-15T07:00:00.000Z"],
  ])(
    "converts %s and round trips independently of runtime timezone",
    (wall, utc) => {
      expect(redmondWallTimeToUtcISO(wall)).toBe(utc);
      expect(redmondInputValue(new Date(utc))).toBe(wall);
    },
  );
  it.each([
    "2026-03-08T02:30",
    "2026-02-31T12:00",
    "2026-13-01T12:00",
    "invalid",
  ])("rejects nonexistent %s", (wall) =>
    expect(redmondWallTimeToUtcISO(wall)).toBeNull(),
  );
  it("copies readable lines with venue, end, description, year and Pacific zone", () => {
    const text = calendarDetails(
      {
        title: "Park gathering",
        startsAt: "2026-07-16T01:00:00Z",
        endsAt: "2026-07-16T02:00:00Z",
        location: "Sample Park, 12 Main Street",
        body: "Bring a blanket.",
      },
      "en",
    );
    expect(text).toContain("Starts: Wednesday, July 15, 2026 at 6:00 PM PDT");
    expect(text).toContain("Ends: Wednesday, July 15, 2026 at 7:00 PM PDT");
    expect(text).toContain(
      "\nLocation: Sample Park, 12 Main Street\nBring a blanket.",
    );
    expect(text).not.toContain("BEGIN:VCALENDAR");
  });
});
describe("venue suggestions", () => {
  it("keeps a venue name together with its full address", () => {
    expect(
      photonLocations({
        features: [
          {
            properties: {
              name: "Sample Park",
              housenumber: "12",
              street: "Main Street",
              city: "Redmond",
              state: "Oregon",
              postcode: "97756",
            },
          },
        ],
      }),
    ).toEqual([
      {
        name: "Sample Park",
        address: "12 Main Street, Redmond, Oregon, 97756",
        value: "Sample Park, 12 Main Street, Redmond, Oregon, 97756",
        source: "public",
      },
    ]);
  });
  it("tolerates malformed provider data and bounds results", () => {
    expect(photonLocations(null)).toEqual([]);
    expect(
      photonLocations({ features: [null, {}, { properties: { name: 123 } }] }),
    ).toEqual([]);
    expect(
      photonLocations({
        features: Array.from({ length: 20 }, () => ({
          properties: { name: "Park" },
        })),
      }),
    ).toHaveLength(6);
  });
});
describe("post tags", () => {
  it("accepts multiple distinct writing tags", () =>
    expect(parsePostTags(["offer", "goods", "offer"])).toEqual([
      "offer",
      "goods",
    ]));
  it("rejects empty, unknown, event and excessive tag selections", () => {
    for (const values of [
      [],
      ["event"],
      ["unknown"],
      ["offer", "need", "aid", "job", "goods", "offer"],
    ])
      expect(parsePostTags(values)).toBeNull();
  });
});
