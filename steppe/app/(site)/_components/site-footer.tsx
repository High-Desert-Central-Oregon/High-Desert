import Link from "next/link";
import { getTranslations } from "next-intl/server";

/**
 * Shared marketing footer (Broadsheet × Plate). Broadsheet restraint: a 3px ink top
 * rule, the structural attribution, the Contact · Privacy links, the founder credit
 * linking out to gregtchism.com, and a mono dateline line. Server component; strings
 * come from the active locale.
 */
export async function SiteFooter() {
  const t = await getTranslations("footer");
  return (
    <footer className="foot">
      <div className="wrap">
        <p className="att">{t.rich("attribution", { b: (c) => <b>{c}</b> })}</p>
        <div className="foot-end">
          <nav className="foot-links" aria-label="Footer">
            <Link href="/contact">{t("contact")}</Link>
            <Link href="/privacy">{t("privacy")}</Link>
          </nav>
          <p className="foot-credit">
            {t("ledBy")}{" "}
            <a href="https://gregtchism.com" target="_blank" rel="noopener noreferrer">
              Greg Chism
            </a>
          </p>
        </div>
        <p className="small">REDMOND · CENTRAL OREGON · EST. 2026</p>
      </div>
    </footer>
  );
}
