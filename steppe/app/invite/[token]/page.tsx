import { Suspense } from "react";
import { InviteShell } from "../invite-shell";
import { normalizeToken } from "@/lib/invite";

/**
 * /invite/<token> — the scanned or tapped form of /invite.
 *
 * NO VALIDATION HERE, AND THAT IS DELIBERATE. The page does not ask whether the
 * token exists, and it renders the same screen whether it does or not. Checking
 * on GET would turn a URL into an oracle: anyone holding a photographed card
 * could probe codes and read the answer off the page. The only place a token's
 * validity is ever revealed is the rate-limited POST, after an address has been
 * supplied — at which point the answer is being given to someone acting on their
 * own invitation rather than to a scanner.
 *
 * A malformed token is dropped rather than rendered into the field, so garbage in
 * the path cannot become garbage in an input the member then has to clear.
 * `normalizeToken` returns "" for anything that is not 32 hex characters, which
 * is exactly the empty-field state /invite already handles.
 */
export const metadata = {
  title: "Redeem an invitation · Steppe",
  robots: { index: false, follow: false },
};

/**
 * `params` is awaited INSIDE the boundary, not in the page body.
 *
 * Under cacheComponents (next.config) params are uncached data, so awaiting them
 * before <Suspense> makes the whole route blocking and the build refuses it:
 * "Uncached data was accessed outside of <Suspense>". /n/[slug] gets away with
 * awaiting params at the top only because the (site) layout already wraps it in a
 * boundary; app/invite has no such layout, so the boundary is here and the await
 * has to sit under it.
 */
async function InviteFromPath({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <InviteShell token={normalizeToken(token)} />;
}

export default function InviteTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  return (
    <Suspense>
      <InviteFromPath params={params} />
    </Suspense>
  );
}
