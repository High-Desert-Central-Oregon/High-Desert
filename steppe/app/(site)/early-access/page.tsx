// Honest "request early access" landing for the marketing CTAs. Steppe launches
// with a founding cohort, so the public "Sign in or join" / "Request early
// access" CTAs point here rather than into the live magic-link signup
// (/auth/login), which stays reachable for existing members. Placeholder: no
// backend/form yet — just sets the founding-cohort expectation. Static + public.
import "../early-access/early-access.css";

export const metadata = {
  title: "Steppe — request early access",
  description:
    "Steppe is launching with a founding cohort in Redmond. Request early access to join.",
};

export default function EarlyAccessPage() {
  return (
    <main className="ea">
      <p className="ea-eyebrow">Founding cohort</p>
      <h1 className="ea-title">Request early access</h1>
      <p className="ea-lede">
        Steppe is opening with a founding cohort of verified Redmond neighbors.
        Membership isn&rsquo;t live to the public yet — leave word and we&rsquo;ll
        reach out as places open.
      </p>
      <p className="ea-note">
        A request form lands here soon. In the meantime, learn more on the{" "}
        <a href="/">main site</a> or read the{" "}
        <a href="/partners">partners &amp; funders</a> page. Already a member?{" "}
        <a href="/auth/login">Sign in</a>.
      </p>
    </main>
  );
}
