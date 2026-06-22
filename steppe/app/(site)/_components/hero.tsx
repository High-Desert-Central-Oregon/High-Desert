// Shared hero for every public (site) page — one visual language, two heights.
//
// This factors the landing's hero (the canonical one) into a single component so
// every page opens the same way: an eyebrow, a title, an optional lead + CTA, and
// the layered strata horizon. Built on the existing hero-sky (weather canvas /
// stars / sun) + strata-horizon — nothing here is redesigned, only unified.
//
//   size="tall"  — the landing's full atmospheric scene (weather drift, night
//                  stars/meteors, drifting clouds + readout, sun/moon orb, and the
//                  tall strata band). Reproduces the landing markup verbatim so the
//                  landing stays pixel-identical and keeps its own landing.css.
//   size="band"  — inner pages: the shorter compact strata band under the copy.
//                  Renders the same .hero / .hero-in / .hero-grid class names each
//                  page's CSS already targets, so no new CSS is needed and each
//                  page keeps its tuned type scale (only copy + height differ).
//
// Palette tokens, fonts, calm motion, and prefers-reduced-motion handling all come
// from the reused hero-sky components + the data-time/data-theme CSS — preserved by
// construction.
//
// Two optional slots keep real pages intact without bloating the prop list:
//   aside    — a right-hand column (the landing phone mock; the join / contact
//              form cards). Its presence switches a band hero to the two-column grid.
//   children — extra below-copy content (factline, price, "updated", note, the
//              landing trustline) that lives inside the copy column.
import { StrataHorizon } from "./strata-horizon";
import { WeatherCanvas, WeatherController, StarLayer, SunOrb } from "./hero-sky";

export type HeroProps = {
  /** "tall" = the landing's full atmospheric scene; "band" = inner-page band. */
  size?: "tall" | "band";
  /** Eyebrow content (text or inline nodes). Wrapped in .eyebrow by the component. */
  eyebrow?: React.ReactNode;
  /** The leading .pip dot before the eyebrow. Off for the landing's location pin. */
  pip?: boolean;
  /** The <h1> content (rich nodes welcome, e.g. <em> emphasis). */
  title: React.ReactNode;
  /** Optional lead paragraph under the title. */
  subtitle?: React.ReactNode;
  /** Optional CTA row under the lead. */
  cta?: React.ReactNode;
  /** Optional right-hand column (phone mock / form card). Switches band to a grid. */
  aside?: React.ReactNode;
  /** Extra below-copy content inside the copy column (factline, price, note…). */
  children?: React.ReactNode;
};

// The copy column — identical shape for both sizes, so the visual language matches.
function HeroCopy({
  eyebrow,
  pip = true,
  title,
  subtitle,
  cta,
  children,
}: Pick<HeroProps, "eyebrow" | "pip" | "title" | "subtitle" | "cta" | "children">) {
  return (
    <>
      {eyebrow != null && (
        <span className="eyebrow">
          {pip && <span className="pip"></span>}
          {eyebrow}
        </span>
      )}
      <h1>{title}</h1>
      {subtitle != null && <p className="lead">{subtitle}</p>}
      {cta != null && <div className="hero-cta">{cta}</div>}
      {children}
    </>
  );
}

export function Hero({
  size = "band",
  eyebrow,
  pip = true,
  title,
  subtitle,
  cta,
  aside,
  children,
}: HeroProps) {
  const copy = (
    <HeroCopy eyebrow={eyebrow} pip={pip} title={title} subtitle={subtitle} cta={cta}>
      {children}
    </HeroCopy>
  );

  // ---- tall: the landing's full atmospheric hero (verbatim structure) ----
  if (size === "tall") {
    return (
      <header className="hero">
        <svg
          className="hero-contour"
          viewBox="0 0 600 500"
          fill="none"
          aria-hidden="true"
        >
          <g stroke="currentColor" strokeWidth="1.2" opacity=".55" fill="none">
            <path d="M-20 180 Q150 120 300 170 T620 150" />
            <path d="M-20 220 Q150 165 300 210 T620 192" />
            <path d="M-20 262 Q150 212 300 252 T620 236" />
            <path d="M-20 306 Q150 260 300 296 T620 282" />
            <path d="M-20 352 Q150 310 300 342 T620 330" />
            <path d="M-20 400 Q150 360 300 390 T620 380" />
          </g>
        </svg>

        <div className="hero-top">
          {/* Copy-area atmosphere: a subtle weather-driven day wind drift across the
              whole copy area + night stars/meteors, behind the copy. */}
          <WeatherCanvas className="hero-wind" subtle />
          <StarLayer
            className="hero-stars"
            count={26}
            meteor
            doubleChance={0.18}
            meteorMin={650}
            meteorMax={2600}
          />

          <div className="hero-grid">
            <div className="hero-copy">{copy}</div>
            {aside}
          </div>
        </div>

        <div className="hero-band">
          {/* Live weather band: clouds + readout + sun/sky softening (controller),
              the 4-mode weather canvas (wind/rain/snow/fog), night stars/meteors,
              and a round sun/moon overlay above the weather so particles pass behind
              it. The strata SVG provides only the sky gradient + hills. */}
          <WeatherController />
          <WeatherCanvas className="band-wind" />
          <StarLayer className="band-stars" count={16} meteor meteorMin={1800} meteorMax={5200} />
          <SunOrb />
          <StrataHorizon variant="hero" />
        </div>
      </header>
    );
  }

  // ---- band: the compact inner-page hero ----
  return (
    <header className="hero">
      {aside != null ? (
        <div className="hero-grid">
          <div>{copy}</div>
          {aside}
        </div>
      ) : (
        <div className="hero-in">{copy}</div>
      )}
      <StrataHorizon variant="compact" />
    </header>
  );
}
