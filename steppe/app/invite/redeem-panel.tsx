"use client";

import { useState } from "react";
import { requestSignInLink } from "@/app/auth/login/actions";
import { MagicLinkForm } from "@/components/magic-link-form";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type Dictionary, type Locale } from "@/lib/i18n";

/**
 * Redeem an invitation, then sign in — one screen, two steps, no dead ends.
 *
 * THE HANDOFF IS THE POINT. Redemption writes the address to the signup
 * allowlist (migration 0027) and stops there. Signing in is then the ORDINARY
 * path: the same `requestSignInLink` server action /auth/login uses, the same
 * one-time code, the same `enforce_invited_signup()` backstop in the database.
 * Nothing here is a shortcut past sign-in; it is a step that happens before it.
 * If this component were deleted, an invited address would still sign in exactly
 * as it does today.
 *
 * WHY IT CALLS THE SEND ITSELF. Once the token is redeemed the member has typed
 * their address once and it is known-good. Handing them a second, identical
 * email field would read as a form that did not listen. So: redeem, send, and
 * mount MagicLinkForm already in its code-entry state — reusing its verify,
 * resend, and "use a different email" machinery rather than restating any of it.
 *
 * NO ORACLE. Every token failure — unknown, expired, exhausted, revoked — comes
 * back as one code and is shown as one sentence. The member learns that the
 * invitation cannot be used, which is what they can act on; a holder of a
 * photographed card learns nothing about a campaign they were not given.
 */
type Stage = "idle" | "submitting" | "sent" | "error";

export function RedeemPanel({
  dict,
  locale,
  initialToken = "",
}: {
  dict: Dictionary;
  locale: Locale;
  /** From /invite/<token>. Empty on /invite, where the code is typed in. */
  initialToken?: string;
}) {
  const [token, setToken] = useState(initialToken);
  const [email, setEmail] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (stage === "submitting") return;
    const fd = new FormData(e.currentTarget as HTMLFormElement);
    setStage("submitting");
    setError(null);

    try {
      const res = await fetch("/api/invite/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          email,
          company: String(fd.get("company") ?? ""), // honeypot
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };

      if (!res.ok || !data.ok) {
        // Two codes, two sentences, and neither says anything about the token's
        // state (see the route). Anything unrecognized reads as the refusal.
        setError(
          data.error === "rate_limited"
            ? dict.invite.errorRateLimited
            : dict.invite.errorRefused,
        );
        setStage("error");
        return;
      }

      // Redeemed. Now the ordinary sign-in send — oracle-free and unchanged. A
      // failure here is NOT a redemption failure: the address is already on the
      // allowlist, so the member can sign in at /auth/login even if this send
      // never lands, and the copy says so rather than implying they must start
      // over.
      const link = await requestSignInLink(email, locale);
      if (!link.ok) {
        setError(dict.invite.errorSendFailed);
        setStage("error");
        return;
      }
      setStage("sent");
    } catch {
      setError(dict.invite.errorNetwork);
      setStage("error");
    }
  };

  // The code has been sent. Hand the rest to the shared sign-in machinery,
  // already primed with the verified address.
  if (stage === "sent") {
    return (
      <MagicLinkForm
        dict={dict}
        locale={locale}
        initialEmail={email}
        startSent
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">{dict.invite.title}</CardTitle>
        <CardDescription>{dict.invite.subtitle}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
          {/* The token field is shown even when it arrived in the URL, so a
              mistyped or truncated code is fixable in place rather than by
              editing the address bar. Read-and-correct beats a dead end. */}
          <div className="grid gap-2">
            <Label htmlFor="invite-token">{dict.invite.tokenLabel}</Label>
            <Input
              id="invite-token"
              name="token"
              type="text"
              inputMode="text"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              required
              value={token}
              onChange={(e) => setToken(e.target.value)}
              aria-describedby="invite-token-hint"
              className="font-mono"
            />
            <p id="invite-token-hint" className="text-xs text-muted-foreground">
              {dict.invite.tokenHint}
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="invite-email">{dict.invite.emailLabel}</Label>
            <Input
              id="invite-email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder={dict.auth.emailPlaceholder}
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-describedby="invite-privacy"
            />
          </div>

          {/* Honeypot — real people leave this empty. Hidden from assistive tech
              as well as from sight, so a screen-reader user is not asked to skip
              a field that means nothing to them. */}
          <div className="hidden" aria-hidden="true">
            <label htmlFor="invite-company">Company</label>
            <input
              id="invite-company"
              name="company"
              type="text"
              tabIndex={-1}
              autoComplete="off"
            />
          </div>

          {error && (
            <p className="text-sm text-red-700 dark:text-red-400" role="alert">
              {error}
            </p>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={stage === "submitting"}
          >
            {stage === "submitting" ? dict.invite.submitting : dict.invite.submit}
          </Button>

          <p id="invite-privacy" className="text-center text-xs text-muted-foreground">
            {dict.invite.privacyNote}
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
