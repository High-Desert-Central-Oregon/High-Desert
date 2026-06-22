import Link from "next/link";
import { getTranslations } from "next-intl/server";

/**
 * Shared marketing footer — Charter system. A hairline Cascade rule over the warm
 * wall, the structural identity line, the two still-linked pages (Privacy · Contact),
 * and the founder credit linking out to gregtchism.com. Server component; strings
 * come from the active locale catalog.
 */
export async function SiteFooter() {
  const t = await getTranslations("footer");
  return (
    <footer className="footer">
      <div className="wrap footer-in">
        <p className="footer-identity">{t("identity")}</p>
        <div className="footer-end">
          <nav className="footer-links" aria-label="Footer">
            <Link href="/privacy">{t("privacy")}</Link>
            <Link href="/contact">{t("contact")}</Link>
          </nav>
          <p className="footer-credit">
            {t("ledBy")}{" "}
            <a href="https://gregtchism.com" target="_blank" rel="noopener noreferrer">
              Greg Chism
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
