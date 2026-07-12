import Link from "next/link";
import Image from "next/image";
import { getTranslations } from "next-intl/server";

/**
 * Shared marketing footer (Broadsheet × Plate). Broadsheet restraint: a 3px ink top
 * rule, the structural attribution, the Contact · Privacy · Terms · Partners links, the founder credit
 * linking out to gregtchism.com, and a mono dateline line. Server component; strings
 * come from the active locale.
 */
export async function SiteFooter() {
  const t = await getTranslations("footer");
  return (
    <footer className="foot">
      <div className="wrap">
        {/* Strata Seal — the official mark beside the commitments line
            (brand-kit manifest tier: official moments; floor 96px). */}
        <Image
          src="/brand/steppe-strata-seal.svg"
          alt={t("sealAlt")}
          width={110}
          height={110}
          className="foot-seal foot-seal-color"
        />
        {/* Dark mode swaps to the mono seal via CSS mask, so the ink inverts to
            the theme's foreground (external SVG — fill can't be set directly,
            so we mask; see site-base.css). */}
        <span
          role="img"
          aria-label={t("sealAlt")}
          className="foot-seal foot-seal-mono"
        />
        <p className="att">{t.rich("attribution", { b: (c) => <b>{c}</b> })}</p>
        <div className="foot-end">
          <nav className="foot-links" aria-label="Footer">
            <Link href="/contact">{t("contact")}</Link>
            <Link href="/privacy">{t("privacy")}</Link>
            <Link href="/legal/terms">{t("terms")}</Link>
            <Link href="/partners">{t("partners")}</Link>
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
