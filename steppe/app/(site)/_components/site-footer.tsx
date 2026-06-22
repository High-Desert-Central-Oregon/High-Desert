import { getTranslations } from "next-intl/server";

/**
 * Shared marketing footer (Broadsheet × Plate). Broadsheet restraint: a 3px ink top
 * rule, the structural attribution, a mono dateline line, and the founder credit
 * linking out to gregtchism.com. Server component; strings come from the active locale.
 */
export async function SiteFooter() {
  const t = await getTranslations("footer");
  return (
    <footer className="foot">
      <div className="wrap">
        <p className="att">{t.rich("attribution", { b: (c) => <b>{c}</b> })}</p>
        <p className="foot-credit">
          {t("ledBy")}{" "}
          <a href="https://gregtchism.com" target="_blank" rel="noopener noreferrer">
            Greg Chism
          </a>
        </p>
        <p className="small">REDMOND · CENTRAL OREGON · EST. 2026</p>
      </div>
    </footer>
  );
}
