import { Suspense } from "react";
import { InviteShell } from "./invite-shell";

/**
 * /invite — redeem an invitation by typing the code.
 *
 * The typed-code route exists because a card gets read aloud over a fence and
 * dictated over a phone at least as often as it gets scanned. /invite/<token> is
 * the scanned form of the same screen.
 *
 * NOT indexed: an invitation is addressed to whoever holds the card, and a
 * search result is not that. There is nothing secret on the page, but there is
 * nothing for a crawler to do with it either.
 */
export const metadata = {
  title: "Redeem an invitation · Steppe",
  robots: { index: false, follow: false },
};

export default function InvitePage() {
  return (
    <Suspense>
      <InviteShell />
    </Suspense>
  );
}
