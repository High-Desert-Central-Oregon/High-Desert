// Minimal pre-launch privacy notice for the public marketing layer. Covers only
// what the /join interest form collects — it is NOT the full member Terms &
// Privacy (that draft, highdesert-terms-privacy-v1, is pending Oregon legal
// review and seeds the member app's `documents`). Static + public. Scoped to
// .privacy; uses the shared brand tokens/fonts via the (site) layout.
import "./privacy.css";

export const metadata = {
  title: "Steppe — privacy notice",
  description:
    "What the Steppe pre-launch signup collects, why, and how to have it deleted.",
};

export default function PrivacyPage() {
  return (
    <main className="privacy">
      <p className="pv-eyebrow">Pre-launch</p>
      <h1 className="pv-title">Privacy notice</h1>
      <p className="pv-lede">
        This covers the pre-launch interest list only &mdash; what you give us on
        the <a href="/join">signup form</a>. When Steppe opens, members get a full
        plain-language Terms &amp; Privacy; this is the short version for now.
      </p>

      <section className="pv-section">
        <h2>What we collect</h2>
        <p>
          Your email address, and &mdash; only if you choose to give them &mdash;
          your first name and whether you&rsquo;re in the Redmond / Central Oregon
          area. That&rsquo;s all. We don&rsquo;t track your browsing, and there are
          no third-party ad or analytics trackers on this site.
        </p>
      </section>

      <section className="pv-section">
        <h2>Why we collect it</h2>
        <p>
          For one purpose: to email you when Steppe opens to new members. We
          don&rsquo;t use it for anything else.
        </p>
      </section>

      <section className="pv-section">
        <h2>What we never do</h2>
        <p>
          We never sell or rent your information, and we never run ads. Your data
          is yours.
        </p>
      </section>

      <section className="pv-section">
        <h2>Deleting your information</h2>
        <p>
          Email{" "}
          <a href="mailto:hello@steppe.community">hello@steppe.community</a> and ask us to
          remove you. We&rsquo;ll delete your entry from the interest list, no
          questions asked.
        </p>
      </section>

      <section className="pv-section">
        <h2>Contact</h2>
        <p>
          Questions about any of this? Reach us at{" "}
          <a href="mailto:hello@steppe.community">hello@steppe.community</a>.
        </p>
      </section>

      <p className="pv-foot">
        <a href="/">Back to the main site</a>
      </p>
    </main>
  );
}
