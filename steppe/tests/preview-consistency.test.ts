import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("public beta walkthrough", () => {
  const previewBundle = read("public/preview-app/steppe-exchange.html");
  const publicEnglish = read("messages/en.json");
  const serializedPage = previewBundle.match(
    /<script type="__bundler\/template">\n([\s\S]*?)\n  <\/script>/,
  );
  const previewPage = JSON.parse(serializedPage?.[1] ?? '""') as string;

  it("keeps the generated walkthrough payload valid and safe to unpack", () => {
    expect(serializedPage).not.toBeNull();
    expect(previewPage).toContain("The Exchange");
    expect(serializedPage?.[1]).not.toMatch(/<\/script>/i);
  });

  it("is identified as a complete planned-beta sample that needs no sign-in", () => {
    expect(publicEnglish).toContain("App walkthrough");
    expect(publicEnglish).toContain("planned beta in full");
    expect(publicEnglish).toContain("all planned beta screens");
    expect(publicEnglish).toContain("no sign-in required");
  });

  it("gives the governance masthead enough room for its full explanation", () => {
    expect(previewBundle).toContain(
      "tab==='govern'?'200px':'var(--nav-exp)'",
    );
    expect(previewBundle).toContain("The running tally is not.");
  });

  it("keeps real-app ownership and moderation terminology", () => {
    expect(previewBundle).toContain("Member-owned · No ads");
    expect(previewBundle).toContain("Pinned by moderators");
    expect(previewBundle).toContain("De los miembros · Sin anuncios");
    expect(previewBundle).toContain("Fijado por la moderación");
    expect(previewBundle).toContain("Sent to a moderator, privately");
    expect(previewBundle).toContain("Enviado a un moderador, en privado");
    expect(previewBundle).not.toContain("Founding beta · No ads");
    expect(previewBundle).not.toContain("Pinned by stewards");
    expect(previewBundle).not.toContain("Beta fundacional · Sin anuncios");
    expect(previewBundle).not.toContain("Fijado por el consejo");
    expect(previewPage).not.toMatch(/\bsteward/i);
    expect(previewPage).toContain("Report to a moderator");
    expect(previewPage).toContain("Elect two board members");
  });

  it("retains the complete planned beta surface", () => {
    for (const feature of [
      "Exchange",
      "Groups",
      "Govern",
      "Messages",
      "New post",
      "secret ballot",
      "data export",
    ]) {
      expect(previewBundle).toContain(feature);
    }
    expect(previewBundle).toContain(
      'data-noscroll=\\"\\" tabindex=\\"0\\" sc-camel-on-scroll=\\"{{ p.onFilterScroll }}\\"',
    );
  });
});
