// Neighborhood pledge page (/n/[slug]) — the destination of every printed QR
// code, mailer, door hanger, and yard sign in the campaign.
//
// Implements docs/decisions/neighborhood-pledge-campaigns.md. Steppe opens here
// only once `threshold` households have pledged; until then nobody verifies an
// address and nobody pays anything.
//
// THREE THINGS THIS PAGE HAS TO GET RIGHT:
//
//  1. The number must be correct at scan time. It is read per request and
//     server-rendered — never baked at build, never fetched by the browser
//     after paint. A stale number on a yard sign's landing page is worse than
//     no number.
//
//  2. It must be readable with no account and no session. Nothing here is
//     gated: neighborhood_status() is granted to anon, and /n/ is on the
//     middleware's public allowlist so it survives the LAUNCH_PHASE gate. That
//     matters because the whole point is that these pages run BEFORE the member
//     app opens in that neighborhood.
//
//  3. An unknown slug must not render an empty pledge card. notFound() sends
//     the visitor to the branded 404, and a neighborhood with no campaign 404s
//     identically to one that does not exist — Steppe publishes no browsable
//     directory of neighborhoods it has no presence in.
//
//     ⚑ KNOWN LIMITATION, NEEDS A DECISION. The 404 PAGE renders, but the HTTP
//     STATUS is 200. cacheComponents (next.config) requires every uncached read
//     to sit behind <Suspense>; the (site) layout provides that boundary, so
//     Next commits a 200 and flushes a shell before this component ever runs the
//     slug lookup. `export const dynamic = "force-dynamic"` is rejected outright
//     under cacheComponents, and moving the segment out of (site) to control the
//     boundary was tried and fails the same rule from its own layout. Two ways
//     to get a true 404, both with a real cost:
//       (a) resolve the slug in the proxy (lib/supabase/proxy.ts) and rewrite
//           unknown ones — the proxy CAN set a status, but it adds a database
//           round-trip to the QR-scan critical path unless the campaign-slug
//           list is cached with a TTL;
//       (b) mark the status read `use cache` with a short cacheLife — that makes
//           the page prerenderable so notFound() can set the status, at the cost
//           of the count being a few seconds stale.
//     Neither is free, and which one is right depends on how much a true 404 is
//     worth against freshness. Flagged rather than chosen.
//
// Structure and copy follow the visual prototype (steppe-neighborhood-pledge-v1
// .jsx), rebuilt on the real design tokens and this project's conventions
// rather than imported: the prototype carried placeholder hexes, inline styles,
// and a Google Fonts @import, none of which belong here.
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { getNeighborhoodStatus, pledgeShareUrl } from "@/lib/pledge";
import { PledgePanel } from "./pledge-panel";
import "./pledge.css";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params) {
  const { slug } = await params;
  const status = await getNeighborhoodStatus(slug);
  if (!status) return { title: "Steppe" };

  const t = await getTranslations("pledge");
  // The count goes in the share preview too — this link gets forwarded to three
  // doors at a time, and the number is what makes it worth opening.
  return {
    title: t("metaTitle", { neighborhood: status.name }),
    description: status.isOpen
      ? t("metaDescOpen", { neighborhood: status.name })
      : t("metaDescForming", {
          neighborhood: status.name,
          count: status.pledgeCount,
          threshold: status.threshold,
        }),
    alternates: { canonical: pledgeShareUrl(status.slug) },
  };
}

export default async function NeighborhoodPledgePage({ params }: Params) {
  // Render at request time, every time. Without this the count could be served
  // from a build-time render, and the number on the page is the whole mechanic.
  await connection();

  const { slug } = await params;
  const status = await getNeighborhoodStatus(slug);
  if (!status) notFound();

  return <PledgePanel status={status} />;
}
