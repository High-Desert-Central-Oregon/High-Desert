import { StrataHorizon } from "./strata-horizon";

/**
 * The original layered-hill landscape, fitted to the current broadsheet hero.
 * Rendered HTML/SVG: no canvas, pointer controls, weather fetch, or animation loop.
 * The existing site time/theme attributes select the sky and celestial body.
 * Keep the orb outside the stretched SVG so it stays round on narrow screens.
 */
export function ClassicLandscape() {
  return (
    <div className="classic-landscape" aria-hidden="true">
      <StrataHorizon variant="hero" />
      <div className="classic-stars" />
      <div className="classic-orb classic-sun" />
      <div className="classic-orb classic-moon" />
    </div>
  );
}
