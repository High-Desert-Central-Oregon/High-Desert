// Contact (/contact) — from the canonical design (steppe-contact.html) on the
// shared chrome + tokens. Text hero + compact strata + a direct mailto: card.
//
// Until transactional email is wired, /contact is a plain mailto: rather than a
// posting form — there is no dead submit path. The full ContactForm (which POSTs
// to /api/contact → Resend) can return once RESEND_API_KEY / CONTACT_TO /
// CONTACT_FROM are set; see lib/contact.ts and app/api/contact/route.ts.
import { getTranslations } from "next-intl/server";
import "./contact.css";
import { StrataHorizon } from "../_components/strata-horizon";

export const metadata = {
  title: "Steppe — contact",
  description:
    "A question, a partnership idea, or just want to know more about Steppe? Send a note and we'll get back to you.",
};

export default async function ContactPage() {
  const t = await getTranslations("contact");
  return (
    <div className="contact">
      <header className="hero">
        <div className="hero-grid">
          <div>
            <span className="eyebrow">
              <span className="pip"></span>{t("heroEyebrow")}
            </span>
            <h1>{t.rich("heroTitle", { em: (c) => <em>{c}</em> })}</h1>
            <p className="lead">{t("heroLead")}</p>
            <div className="aside">
              <div className="k">{t("asideK")}</div>
              <p>
                {t.rich("asideP", {
                  link: (c) => <a href="mailto:hello@steppe.community">{c}</a>,
                })}
              </p>
              <div className="resp">{t("resp")}</div>
            </div>
          </div>
          <div className="formcard" id="contact-card">
            <div className="fk">{t("formKicker")}</div>
            <h2>{t("formH")}</h2>
            <p className="fsub">{t("mailtoSub")}</p>
            <a
              className="submitb"
              href="mailto:hello@steppe.community?subject=Hello%20Steppe"
            >
              {t("mailtoCta")}
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M3 8h9M8.5 4l4 4-4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
            <p className="formnote">
              {t.rich("formnote", {
                link: (c) => <a href="/privacy">{c}</a>,
              })}
            </p>
          </div>
        </div>
        <StrataHorizon variant="compact" />
      </header>
    </div>
  );
}
