# Color accessibility fixture

From `steppe/`, after `npm ci`, run:

```sh
./node_modules/.bin/vite --config tests/fixtures/color-accessibility/vite.config.mjs
```

Open `http://127.0.0.1:8769/`. Vite is installed by the existing Vitest development toolchain. This fixture is excluded from the Next application and has no backend, credentials, or submission handlers. It renders the production `ChoiceCard`, `Input`, and `Button`, the real English/Spanish verification dictionaries, and the production styles for website controls. Fonts use local system fallbacks; this is a color/state fixture, not a typography reference.

Check:

- All five verification methods: native arrow-key selection, checked radio, help text, whole-card focus, and hover.
- English and Spanish, including the long postcard description at 390px width.
- Tab through the reply field, input, select, and list row. Each needs a visible focus indicator.
- Both website themes: form boundary, small accent text, beta-action hover, pledge submit, and copied confirmation.
- Loading website styles must leave the member app's paper/ink and HSL `--card` token intact.

Automated color-pair regressions run with:

```sh
npm run test -- tests/color-accessibility.test.ts
```

The contrast tests verify actual CSS token values against WCAG thresholds. The browser fixture additionally checks the rendered composition and state wiring; neither replaces complete journey or assistive-technology testing.
