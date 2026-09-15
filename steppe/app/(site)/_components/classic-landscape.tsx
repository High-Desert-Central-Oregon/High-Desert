import { StrataHorizon } from "./strata-horizon";
import { ClassicStars } from "./classic-stars";

/**
 * The original layered-hill landscape, fitted to the current broadsheet hero.
 * Rendered HTML/SVG, with an optional night-sky animation over static stars.
 * The existing site time/theme attributes select the sky and celestial body.
 * Keep the orb outside the stretched SVG so it stays round on narrow screens.
 */
export function ClassicLandscape() {
  return (
    <div className="classic-landscape" aria-hidden="true">
      <StrataHorizon variant="hero" />
      <ClassicStars />
      <div className="classic-orb classic-sun" />
      <div className="classic-orb classic-moon" />
    </div>
  );
}
