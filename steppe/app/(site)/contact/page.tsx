// Contact (/contact) — from the canonical design (steppe-contact.html) on the
// shared chrome + tokens. Text hero + compact strata + the real ContactForm
// (posts to /api/contact → Resend). Copy is localized from the "contact" catalog;
// the direct mailto: stays visible as the fallback.
import { getTranslations } from "next-intl/server";
import "./contact.css";
import { ContactForm } from "./contact-form";
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
          <ContactForm />
        </div>
        <StrataHorizon variant="compact" />
      </header>
    </div>
  );
}
