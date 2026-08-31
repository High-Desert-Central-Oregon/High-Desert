import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("2026-08-29 privacy resolution", () => {
  const migration = read("../migrations/0034_message_deletion_consistency.sql");
  const joinForm = read("app/(site)/join/join-form.tsx");
  const publicEnglish = read("messages/en.json");
  const formalPrivacy = read("content/legal/privacy.md");
  const appEnglish = read("lib/i18n/dictionaries/en.ts");
  const appSpanish = read("lib/i18n/dictionaries/es.ts");

  it("deletes the departing member's sent messages and empty threads only", () => {
    expect(migration).toContain(
      "delete from public.messages where sender_id = v_uid",
    );
    expect(migration).toMatch(
      /delete from public\.threads t[\s\S]+not exists \([\s\S]+public\.messages/,
    );
    expect(migration).not.toMatch(/grant delete on (public\.)?messages/i);
  });

  it("requires an explicit client-side checkbox instead of manufacturing consent", () => {
    expect(joinForm).toContain('name="consent"');
    expect(joinForm).toContain('type="checkbox"');
    expect(joinForm).toContain('fd.get("consent") === "true"');
    expect(joinForm).not.toContain("consent: true");
  });

  it("makes no unimplemented timed-message or unnamed-payment promise", () => {
    const currentCopy = `${publicEnglish}\n${formalPrivacy}`;
    expect(currentCopy).not.toContain("[PAYMENT PROCESSOR]");
    expect(currentCopy).not.toContain("messages for a short window");
    expect(currentCopy).not.toContain("We keep them only for a limited window");
  });

  it("describes sent-message deletion consistently in the live app", () => {
    expect(appEnglish).toContain("the messages you sent");
    expect(appEnglish).not.toContain("Messages you sent stay");
    expect(appSpanish).toContain("los mensajes que enviaste");
    expect(appSpanish).not.toContain("Los mensajes que enviaste se quedan");
  });
});
