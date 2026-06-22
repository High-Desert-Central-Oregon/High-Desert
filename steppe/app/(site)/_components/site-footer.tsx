import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { SealMark } from "./seal-mark";

/**
 * Shared marketing footer (v5 design). Seal + wordmark, the nonprofit/contact
 * meta block, the Explore links, and the founder credit linking out to
 * gregtchism.com. Server component; strings come from the active locale catalog.
 */
export async function SiteFooter() {
  const t = await getTranslations("footer");
  return (
    <footer className="footer">
      <div className="wrap footer-in">
        <div>
          <Link className="brand" href="/">
            <SealMark size={28} clipId="seal-foot" />
            Steppe
          </Link>
          <p className="footer-meta" style={{ marginTop: 16 }}>
            {t("org1")}
            <br />
            {t("org2")}
            <br />
            <a href="mailto:hello@steppe.community">hello@steppe.community</a>
          </p>
        </div>
        <div className="footer-links">
          <span className="head">{t("explore")}</span>
          <Link href="/preview">{t("preview")}</Link>
          <Link href="/partners">{t("partners")}</Link>
          <Link href="/privacy">{t("privacy")}</Link>
          <Link href="/contact">{t("contact")}</Link>
        </div>
        <div className="footer-meta" style={{ alignSelf: "flex-end" }}>
          {t("ledBy")}{" "}
          <a
            href="https://gregtchism.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            Greg Chism
          </a>
        </div>
      </div>
    </footer>
  );
}
