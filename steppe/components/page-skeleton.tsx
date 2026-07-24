/**
 * Brand-styled loading placeholders. Two consumers, same visual language:
 *   • in-page <Suspense fallback> — streams the dynamic part of an already-
 *     rendered page (24 pages use PageSkeleton here today), and
 *   • route-level loading.tsx — the INSTANT client-side skeleton shown on tap,
 *     before any server round-trip (the click→first-byte feedback the in-page
 *     fallbacks can't give).
 *
 * All three shapes share one kit — the gentle pulse, muted bars, and card/hairline
 * blocks (palette tokens, invariant 9: calm on a slow phone) — and differ only in
 * silhouette, so each route's loading.tsx can shape-MATCH its destination and not
 * shift layout when the real content lands. Purely decorative: aria-hidden, so
 * screen readers wait for the real heading/landmarks. All are sized to sit inside
 * the protected layout's padded <main>.
 */

/** Title bar + voice line — stands in for the <Masthead>/header each page opens with. */
function SkeletonMasthead() {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="h-7 w-1/2 rounded-md bg-muted" />
      <div className="h-4 w-3/4 max-w-md rounded bg-muted" />
    </div>
  );
}

/** Cards silhouette — header + three card blocks. The Home status cards and the
 *  event-detail shape; the default in-page fallback. */
export function PageSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-8" aria-hidden="true">
      <SkeletonMasthead />
      <div className="flex flex-col gap-3">
        <div className="h-20 rounded-lg border bg-card" />
        <div className="h-20 rounded-lg border bg-card" />
        <div className="h-20 rounded-lg border bg-card" />
      </div>
    </div>
  );
}

/** List silhouette — header + a hairline-divided stack of rows. Matches the
 *  Masthead + <ul> pages (exchange, governance, groups, messages, moderation,
 *  review, account). */
export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="flex animate-pulse flex-col gap-8" aria-hidden="true">
      <SkeletonMasthead />
      <div className="flex flex-col divide-y border-y">
        {Array.from({ length: rows }, (_, i) => (
          <div key={`row-${i}`} className="flex flex-col gap-2 py-4">
            <div className="h-4 w-2/5 rounded bg-muted" />
            <div className="h-3 w-3/4 max-w-sm rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Form silhouette — header + labeled field blocks + a submit button. Matches the
 *  form pages (verify, neighborhoods, and the new/edit forms). */
export function FormSkeleton({ fields = 3 }: { fields?: number }) {
  return (
    <div className="flex animate-pulse flex-col gap-6" aria-hidden="true">
      <SkeletonMasthead />
      <div className="flex flex-col gap-5">
        {Array.from({ length: fields }, (_, i) => (
          <div key={`field-${i}`} className="flex flex-col gap-2">
            <div className="h-4 w-24 rounded bg-muted" />
            <div className="h-10 rounded-md border bg-card" />
          </div>
        ))}
      </div>
      <div className="h-10 w-40 rounded-md bg-muted" />
    </div>
  );
}
