import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

// Render-invariant guards for the profile-visibility control (the chip↔text
// desync finding). Two kinds, both dependency-free (no RTL/jsdom in this repo):
//   (a) a REAL render of the control at each confirmed value, asserting the chip
//       highlight, the radio `checked`, and the helper text all AGREE; plus a
//       source-structural assertion that all three derive from the single
//       `shown` source (the interactive settled-error transition needs RTL the
//       repo doesn't have — this pins the "can never disagree" invariant instead);
//   (b) a static guard that the highlight is React-driven, never CSS :checked.
//
// Importing the component pulls its server-action import; mock ONLY that so no
// Next request context (next/headers) is needed. The component itself is real.
vi.mock("@/app/protected/account/actions", () => ({
  updateDisplayName: async () => null,
  setFieldVisibility: async () => null,
}));

const SRC = readFileSync(
  new URL("../app/protected/account/profile/profile-form.tsx", import.meta.url),
  "utf8",
);

/** Render ProfileForm with one visibility field set to `visibility` and return
 *  the static HTML (initial render == the SETTLED value: on success field.visibility
 *  is the new value; on not-persisted the effect reconciles selected back to it). */
async function render(visibility: "hidden" | "members"): Promise<string> {
  const { ProfileForm } = await import(
    "@/app/protected/account/profile/profile-form"
  );
  const { en } = await import("@/lib/i18n/dictionaries/en");
  return renderToStaticMarkup(
    createElement(ProfileForm as never, {
      displayName: "Test",
      dict: en,
      fields: [
        {
          field: "neighborhood_visibility",
          label: "Neighborhood",
          value: "Ridgeview",
          visibility,
        },
      ],
    }),
  );
}

/** The <label> class wrapping the radio with this value (the chip highlight). */
function labelClassFor(html: string, value: string): string | null {
  const m = html.match(
    new RegExp(`<label class="([^"]*)"><input[^>]*value="${value}"`),
  );
  return m ? m[1] : null;
}

/** The full <input> tag for this value (to read its `checked` state). */
function inputTagFor(html: string, value: string): string | null {
  const m = html.match(new RegExp(`<input[^>]*value="${value}"[^>]*>`));
  return m ? m[0] : null;
}

/** The helper status line text. */
function statusText(html: string): string | null {
  const m = html.match(/role="status"[^>]*>([^<]*)</);
  return m ? m[1] : null;
}

describe("profile visibility — render invariant", () => {
  for (const v of ["hidden", "members"] as const) {
    it(`(a) confirmed value "${v}": chip highlight, radio checked, and helper text all agree`, async () => {
      const html = await render(v);
      const other = v === "hidden" ? "members" : "hidden";

      // chip highlight: the selected value's label is accented, the other is not
      expect(labelClassFor(html, v)).toContain("border-accent");
      expect(labelClassFor(html, other) ?? "").not.toContain("border-accent");

      // radio checked: the selected value is checked, the other is not
      expect(inputTagFor(html, v) ?? "").toContain("checked");
      expect(inputTagFor(html, other) ?? "").not.toContain("checked");

      // helper text: matches the same value
      const en = (await import("@/lib/i18n/dictionaries/en")).en;
      expect(statusText(html)).toBe(
        v === "members" ? en.account.visStateMembers : en.account.visStateHidden,
      );
    });
  }

  it("(a) invariant: chip, checked, and helper text all derive from the single `shown` source, and `selected` is reconciled on settle", () => {
    // The chip highlight, the radio `checked`, and the helper text must ALL read
    // from `shown` — one source, so no render can show them disagreeing. (A real
    // interactive drive of the settled-error state needs RTL the repo lacks; this
    // encodes the invariant that made that bug possible: chip bound to `selected`
    // while text bound to `shown`.)
    expect(SRC).toMatch(/shown === o\.value \? "border-accent/); // highlight ← shown
    expect(SRC).toMatch(/checked=\{shown === o\.value\}/); //          checked   ← shown
    expect(SRC).toMatch(/shown === "members" \? a\.visStateMembers/); // text    ← shown
    // and no display element may bind to the raw optimistic `selected`
    expect(SRC).not.toMatch(/checked=\{selected === o\.value\}/);
    // the reconcile effect clears the stale optimistic pick after a settled action
    expect(SRC).toMatch(/setSelected\(field\.visibility\)/);
  });

  it("(b) static guard: the visibility highlight is React-driven, never CSS :has(:checked)", () => {
    // jsdom/happy-dom cannot reproduce the :has(:checked) DOM-desync that made the
    // chip and text disagree, so THIS source-level guard is what pins the
    // regression class. If the highlight is ever driven by the DOM radio's
    // :checked pseudo again, this fails.
    expect(SRC).not.toMatch(/has-\[:checked\]/); // the regressing pattern
    // (the focus ring legitimately still uses has-[:focus-visible] — different pseudo)
    expect(SRC).toMatch(/has-\[:focus-visible\]/);
  });
});
