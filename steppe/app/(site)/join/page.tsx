// Public pre-launch interest signup (the (site) marketing layer). Server
// component for metadata + static copy; the interactive form is a client island
// (./join-form) that posts to /api/interest. Uses the shared brand tokens/fonts
// (styles/brand-tokens.css via the (site) layout). Scoped to .join.
import "./join.css";
import { JoinForm } from "./join-form";

export const metadata = {
  title: "Steppe — get word when we open",
  description:
    "Steppe is launching with a founding cohort in Redmond, Oregon. Leave your email and we'll reach out when membership opens. No ads, no tracking, ever.",
};

export default function JoinPage() {
  return (
    <main className="join">
      <div className="join-inner">
        <p className="join-eyebrow reveal">Founding cohort</p>
        <h1 className="join-title reveal">Be there when Steppe opens.</h1>
        <p className="join-lede reveal">
          Steppe is launching with a founding cohort of verified Redmond
          neighbors. Membership isn&rsquo;t public yet &mdash; leave your email and
          we&rsquo;ll reach out the moment a place opens for you.
        </p>

        <JoinForm />

        <p className="join-foot reveal">
          Already a member? <a href="/auth/login">Sign in</a>.
        </p>
      </div>
    </main>
  );
}
