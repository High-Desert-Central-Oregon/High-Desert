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
//  3. An unknown slug must return a REAL 404 status, not 200 with apologetic
//     content — and that is NOT enforced here. It cannot be. Under
//     cacheComponents every uncached read must sit behind <Suspense>, so the
//     (site) layout's boundary makes Next commit a 200 and flush a shell before
//     this component ever runs the lookup; notFound() below can then change the
//     body but not the status. Both segment configs that would express "this
//     param does not exist" — `dynamic` and `dynamicParams` — are rejected
//     outright by cacheComponents, and generateStaticParams without
//     dynamicParams still renders unknown params on demand (all three verified,
//     not assumed).
//
//     The gate therefore lives in lib/supabase/proxy.ts, the last layer that
//     can still set a status. notFound() is kept here as the backstop for the
//     case the proxy deliberately allows through: it fails OPEN when the slug
//     lookup is unavailable, so a database blip degrades to the old soft 404
//     rather than 404-ing live neighborhoods.
//
//     A neighborhood with no campaign is refused identically to one that does
//     not exist. Steppe publishes no browsable directory of neighborhoods it
//     has no presence in.
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
