import type { Dictionary } from "@/lib/i18n";

/**
 * THE single source of the member app's primary destinations
 * (docs/audits/preview-nav-spec-v1.md §1/§5). Both presentations — the bottom
 * tab bar below md and the top rail at md+ — render from this array, so the two
 * can never drift. Order is the preview bundle's tab order: EXCHANGE holds slot 1
 * (X1 shipped — docs/spec/exchange-x1-spec-v1.md §6); Events folded into its
 * bundle-native homes (the EVENT category on the board + per-group Upcoming),
 * with /protected/events redirecting to the EVENT filter.
 *
 * Destinations are NOT verification-gated here: the tabs are always visible and
 * the pages themselves gate (VerifiedGate) — the bundle's model (spec §2).
 */
export type Destination = {
  key: "exchange" | "groups" | "govern" | "you";
  href: string;
  label: string;
};

export function destinations(dict: Dictionary): Destination[] {
  return [
    { key: "exchange", href: "/protected/exchange", label: dict.nav.exchangeLink },
    { key: "groups", href: "/protected/groups", label: dict.nav.groupsLink },
    { key: "govern", href: "/protected/governance", label: dict.nav.governanceLink },
    { key: "you", href: "/protected/account", label: dict.nav.accountLink },
  ];
}
