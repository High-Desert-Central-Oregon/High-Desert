// Contact (/contact) — from the canonical design (steppe-contact.html) on the
// shared chrome + tokens. Text hero + compact strata + the real ContactForm
// (posts to /api/contact → Resend), in the same design language as /join.
//
// The form shows when transactional email is configured (RESEND_API_KEY set in the
// deploy env); if it's missing we fall back to a direct mailto: card so /contact is
// never a dead form. See lib/contact.ts + app/api/contact/route.ts.
import { getTranslations } from "next-intl/server";
import "./contact.css";
import { Hero } from "../_components/hero";
import { ContactForm } from "./contact-form";

export const metadata = {
  title: "Steppe — contact",
  description:
    "A question, a partnership idea, or just want to know more about Steppe? Send a note and we'll get back to you.",
};

export default async function ContactPage() {
  const t = await getTranslations("contact");
  // Server-side: render the real form when Resend is configured; otherwise fall back
  // to a direct mailto: card so /contact is never a dead form.
  const emailEnabled = !!process.env.RESEND_API_KEY;
  return (
    <div className="contact">
      <Hero
        size="band"
        eyebrow={t("heroEyebrow")}
        title={t.rich("heroTitle", { em: (c) => <em>{c}</em> })}
        subtitle={t("heroLead")}
        aside={
          emailEnabled ? (
            <ContactForm />
          ) : (
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
          )
        }
      >
        <div className="aside">
          <div className="k">{t("asideK")}</div>
          <p>
            {t.rich("asideP", {
              link: (c) => <a href="mailto:hello@steppe.community">{c}</a>,
            })}
          </p>
          <div className="resp">{t("resp")}</div>
        </div>
      </Hero>
    </div>
  );
}
