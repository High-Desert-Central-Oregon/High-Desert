/**
 * The stratigraphic column — the campaign's signature element.
 *
 * One pledged household is one layer of rock. The neighborhood builds itself up
 * from bedrock toward the sky, and the threshold IS the horizon line. It is the
 * reason the printed materials are worth a second look and the reason the
 * mechanic films well (momentum pack § 2, angle B).
 *
 * Deliberately pure markup + CSS: no canvas, no images, no JavaScript. It has to
 * paint on a slow phone on a bad connection at a mailbox, and it has to be in
 * the server-rendered HTML rather than appear a second later.
 *
 * ACCESSIBILITY: aria-hidden. The count, the threshold, and how many remain are
 * all stated in real text immediately beside it, so exposing the column to a
 * screen reader would only read the same fact a second time — as 35 anonymous
 * divs. Decoration that duplicates adjacent text is noise, not access.
 */

/** Above this, the column stops being legible as countable layers. */
const MAX_BANDS = 120;

/**
 * Deterministic per-layer lightness variation, so the column reads as rock
 * rather than as a progress bar. Same input always gives the same output, so
 * server and client render identically (a random value here would hydrate
 * mismatched).
 */
function bandTint(i: number): number {
  const n = Math.sin((i + 1) * 12.9898) * 43758.5453;
  return 0.88 + (n - Math.floor(n)) * 0.18;
}

export function StrataColumn({
  count,
  threshold,
}: {
  count: number;
  threshold: number;
}) {
  const slots = Math.min(Math.max(threshold, count), MAX_BANDS);
  const shown = Math.min(count, slots);

  return (
    <div className="strata" aria-hidden="true">
      <div className="strata-sky">
        <div className="strata-stack">
          {Array.from({ length: slots }, (_, i) => {
            const filled = i < shown;
            // Stratigraphic position 0..1, bedrock to rimrock. Keyed to the
            // THRESHOLD, not to the number of slots, so a layer keeps its colour
            // as the count grows past it — the rock does not repaint itself.
            const depth = Math.min(i / Math.max(threshold - 1, 1), 1);
            return (
              <div
                key={i}
                className={filled ? "band band-filled" : "band"}
                style={{
                  height: `${100 / slots}%`,
                  ...(filled
                    ? {
                        background: `color-mix(in oklab, var(--strata-${unitFor(depth)}) 100%, white ${((bandTint(i) - 1) * 100).toFixed(1)}%)`,
                      }
                    : null),
                }}
              />
            );
          })}
        </div>

        {/* The horizon: where the neighborhood opens. Drawn only while it is
            still ahead — once crossed, there is nothing left to reach for. */}
        {count < threshold && (
          <div
            className="strata-horizon"
            style={{ bottom: `${(threshold / slots) * 100}%` }}
          >
            <span className="strata-horizon-rule" />
            <span className="strata-horizon-num">{threshold}</span>
          </div>
        )}
      </div>
    </div>
  );
}

/** Seven bands of Steppe palette, bedrock (basalt) to rimrock (rust). */
function unitFor(depth: number): number {
  if (depth <= 0.16) return 1;
  if (depth <= 0.31) return 2;
  if (depth <= 0.47) return 3;
  if (depth <= 0.63) return 4;
  if (depth <= 0.79) return 5;
  if (depth <= 0.91) return 6;
  return 7;
}
