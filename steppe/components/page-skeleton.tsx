/**
 * A brand-styled loading placeholder for page-content <Suspense> fallbacks, so a
 * slow phone sees a calm skeleton instead of a blank gap while the dynamic part
 * streams in (invariant 9 — low-bandwidth, mobile-first). Uses the palette tokens
 * (muted bars, card blocks) and the same gentle pulse the rest of the app would.
 *
 * Purely decorative: aria-hidden, so screen readers aren't told to read empty
 * placeholders — the real content (with its heading/landmarks) announces itself
 * once it arrives. Sized to sit inside the protected layout's padded <main>.
 */
export function PageSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-8" aria-hidden="true">
      <div className="flex flex-col gap-2.5">
        <div className="h-7 w-1/2 rounded-md bg-muted" />
        <div className="h-4 w-3/4 max-w-md rounded bg-muted" />
      </div>
      <div className="flex flex-col gap-3">
        <div className="h-20 rounded-lg border bg-card" />
        <div className="h-20 rounded-lg border bg-card" />
        <div className="h-20 rounded-lg border bg-card" />
      </div>
    </div>
  );
}
