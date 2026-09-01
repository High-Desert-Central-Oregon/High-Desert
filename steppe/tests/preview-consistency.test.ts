import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("public beta walkthrough", () => {
  const previewBundle = read("public/preview-app/steppe-exchange.html");
  const publicEnglish = read("messages/en.json");
  const accountPage = read("app/protected/account/page.tsx");
  const appNav = read("app/protected/app-nav.tsx");
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

  it("keeps the You surface aligned to shipped beta doors", () => {
    for (const label of [
      "Your groups",
      "Your governance",
      "Messages",
      "My calendar",
      "Neighborhood",
      "Your data",
      "Sign out",
    ]) {
      expect(previewPage).toContain(label);
    }

    for (const liveReference of [
      "dict.account.groupsRow",
      "dict.account.governanceRow",
      "dict.messages.title",
      "dict.calendar.title",
      "dict.nav.neighborhoodLink",
      "dict.account.dataRow",
    ]) {
      expect(accountPage).toContain(liveReference);
    }

    expect(previewPage).not.toContain("ySaved:");
    expect(previewPage).not.toContain("yMembership:");
    expect(previewPage).not.toContain("ySettings:");
    expect(previewPage).not.toContain("$4/mo");
    expect(previewPage).not.toContain("Opens in the full app");
  });

  it("keeps the language control on the left side of the real shell", () => {
    expect(appNav.indexOf("<LanguageSwitcher")).toBeGreaterThan(-1);
    expect(appNav.indexOf("<LanguageSwitcher")).toBeLessThan(
      appNav.indexOf("<Wordmark"),
    );
  });

  it("contains the direct preview so its tab rail cannot jump with page scroll", () => {
    expect(previewPage).toContain('id="steppe-preview-stage"');
    expect(previewPage).toContain('id="steppe-preview-phone"');
    expect(previewPage).toContain("overflow:clip;-webkit-font-smoothing");
    expect(previewPage).toContain(
      "align-items:center;justify-content:center;overflow:clip",
    );
    expect(previewPage).toContain(
      "Math.min(1, availableWidth / 402, availableHeight / 872)",
    );
    expect(previewPage).toContain(
      "window.addEventListener('resize', fitPreview, { passive: true })",
    );
  });
});
