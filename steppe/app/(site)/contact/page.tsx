// Contact (/contact) — rebuilt from the canonical design
// (_design-source/steppe-contact.html) on the shared chrome + tokens. Text hero +
// compact strata, with the real ContactForm (posts to /api/contact → Resend →
// hello@steppe.community). The direct mailto: stays visible as the fallback.
import "./contact.css";
import { ContactForm } from "./contact-form";
import { StrataHorizon } from "../_components/strata-horizon";

export const metadata = {
  title: "Steppe — contact",
  description:
    "A question, a partnership idea, or just want to know more about Steppe? Send a note and we'll get back to you.",
};

export default function ContactPage() {
  return (
    <div className="contact">
      <header className="hero">
        <div className="hero-grid">
          <div>
            <span className="eyebrow">
              <span className="pip"></span>Contact
            </span>
            <h1>
              Get in <em>touch.</em>
            </h1>
            <p className="lead">
              A question, a partnership idea, or just want to know more about
              Steppe? Send a note and we&rsquo;ll get back to you.
            </p>
            <div className="aside">
              <div className="k">Prefer your own mail app?</div>
              <p>
                Write to us directly at{" "}
                <a href="mailto:hello@steppe.community">hello@steppe.community</a>.
              </p>
              <div className="resp">We usually reply within a few days.</div>
            </div>
          </div>
          <ContactForm />
        </div>
        <StrataHorizon variant="compact" />
      </header>
    </div>
  );
}
