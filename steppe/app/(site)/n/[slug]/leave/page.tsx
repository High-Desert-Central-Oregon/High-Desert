// Removal confirmation (/n/[slug]/leave?token=…) — where the unsubscribe link
// in the confirmation email lands.
//
// WHY A PAGE AND NOT A LINK THAT JUST DELETES: mail clients, security scanners,
// and link previewers fetch URLs in the background. A GET that removed the row
// would silently unsubscribe people who never touched the link, and they would
// find out only when the neighborhood opened without them. The link opens this;
// this page's button posts to /api/pledge/remove.
//
// Nothing here reads the pledge. The token is not looked up before the button
// is pressed, so this page cannot be used to test whether a guessed token is
// real — it renders identically either way.
import { getTranslations } from "next-intl/server";
import { getNeighborhoodStatus } from "@/lib/pledge";
import { LeaveForm } from "./leave-form";
import "../pledge.css";

export const metadata = {
  title: "Steppe",
  // A removal page has no business in a search index.
  robots: { index: false, follow: false },
};

export default async function LeavePledgePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const [{ slug }, { token }, t] = await Promise.all([
    params,
    searchParams,
    getTranslations("pledge"),
  ]);

  // Only for the neighborhood's display name. A slug with no campaign still
  // renders the page, because someone holding a token from a campaign that has
  // since closed must still be able to act on it.
  const status = await getNeighborhoodStatus(slug);
  const name = status?.name ?? slug;

  return (
    <div className="pledge">
      <div className="pledge-wrap">
        <div className="pledge-leave">
          <p className="pledge-eyebrow">{t("leaveEyebrow")}</p>
          <h1 className="pledge-title">{name}</h1>

          {token ? (
            <LeaveForm slug={slug} token={token} neighborhood={name} />
          ) : (
            <p className="pledge-lead">{t("leaveNoToken")}</p>
          )}
        </div>
      </div>
    </div>
  );
}
