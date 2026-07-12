/**
 * Taxonomy → brand-marker fill for MarkerChip squares. Colors are the
 * exchange-design-tokens-reference.css marker set, exposed as --marker-* in
 * globals.css. A marker is NEVER color alone — MarkerChip pairs every square
 * with its mono label — so repeated colors across categories are fine (the
 * label carries identity; the square is family, not a key).
 */

const SAGE = "var(--marker-sage)";
const OCHRE = "var(--marker-ochre)";
const SLATE = "var(--marker-slate)";
const GOODS = "var(--marker-goods)";
const JUNIPER = "var(--marker-juniper)";
const RUST = "var(--marker-rust)";
const NEUTRAL = "var(--marker-neutral)";

/** Group categories: the reference's Exchange markers where a category maps
 *  cleanly onto one (goods/aid/services/events/markets); sage otherwise. */
const CATEGORY_MARKERS: Record<string, string> = {
  "buy-sell-trade-free": GOODS,
  "help-mutual-aid": SLATE,
  "services-skills": JUNIPER,
  "events-happenings": OCHRE,
  markets: SAGE,
};

export function categoryMarker(slug: string | null | undefined): string {
  return (slug && CATEGORY_MARKERS[slug]) || SAGE;
}

/** Uncategorized events: the bundle's own event marker (--cat-event, ochre). */
export const EVENT_MARKER = OCHRE;

/** Visibility: open green for public, the quiet neutral for members-only. */
export function visibilityMarker(v: "public" | "members_only"): string {
  return v === "public" ? SAGE : NEUTRAL;
}

/** Proposal kinds: routine juniper → heightened ochre → consequential rust
 *  (rust as a marker is a sanctioned accent use; immutable is the platform's
 *  most consequential act). */
export function kindMarker(kind: "minor" | "major" | "immutable"): string {
  return kind === "immutable" ? RUST : kind === "major" ? OCHRE : JUNIPER;
}
