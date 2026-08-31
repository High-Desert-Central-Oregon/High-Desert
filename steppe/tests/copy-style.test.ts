import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { en } from "@/lib/i18n/dictionaries/en";
import { es } from "@/lib/i18n/dictionaries/es";

function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === "object") {
    return Object.values(value).flatMap(strings);
  }
  return [];
}

describe("public copy style", () => {
  const publicEnglish = JSON.parse(
    readFileSync(resolve(process.cwd(), "messages/en.json"), "utf8"),
  );
  const publicSpanish = JSON.parse(
    readFileSync(resolve(process.cwd(), "messages/es.json"), "utf8"),
  );
  const previewBundle = readFileSync(
    resolve(process.cwd(), "public/preview-app/steppe-exchange.html"),
    "utf8",
  );

  it("does not use em dashes in copy shown to members or visitors", () => {
    const visibleCopy = [
      ...strings(publicEnglish),
      ...strings(publicSpanish),
      ...strings(en),
      ...strings(es),
      previewBundle,
    ];

    for (const text of visibleCopy) expect(text).not.toContain("—");
    expect(previewBundle).not.toContain("\\u2014");
    expect(previewBundle).not.toMatch(/&(?:mdash|#8212|#x2014);/i);
  });

  it("keeps the preview description concrete", () => {
    const copy = strings(publicEnglish).join("\n");
    expect(copy).not.toContain("full-product facsimile");
    expect(copy).not.toContain("complete intended experience");
    expect(copy).not.toContain("One honest feed");
    expect(copy).not.toContain("Private until you say so");
  });
});
