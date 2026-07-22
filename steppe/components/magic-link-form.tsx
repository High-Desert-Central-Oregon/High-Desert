"use client";

import { useState } from "react";
import { requestSignInLink, verifyEmailCode } from "@/app/auth/login/actions";
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
import { CheckCircle2 } from "lucide-react";
import { t, type Dictionary, type Locale } from "@/lib/i18n";

/**
 * Passwordless sign-in / join. Submitting calls the `requestSignInLink` SERVER
 * ACTION, which is INVITE-ONLY (migration 0024): only an email on the allowlist
 * is sent a one-time code + link (and, if new, has its account created). The
 * check runs server-side so a tampered client can't skip it, and the database
 * backstop (`enforce_invited_signup`) refuses a non-allowlisted signup even
 * against a direct GoTrue call. There is no password to remember or leak.
 *
 * The action returns an identical neutral result for every well-formed address —
 * invited or not — so we always show the same "check your email" state and never
 * reveal whether an address is on the invite list (no enumeration oracle).
 *
 * The post-send state LEADS with the 6-digit code and demotes the link, on
 * purpose: typing the code keeps sign-in in THIS browser, while tapping the
 * link from Gmail/Proton opens the email app's in-app webview — where the
 * session never reaches the member's real browser and the verification
 * file picker is dead. Same send, two redemptions; the code is the safe one.
 */
export function MagicLinkForm({
  dict,
  locale,
}: {
  dict: Dictionary;
  locale: Locale;
}) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [resent, setResent] = useState(false);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setCodeError(null);
    setResent(false);
    if (code.length !== 6) {
      setCodeError(dict.auth.codeInvalid);
      return;
    }
    setIsVerifying(true);
    try {
      // On success the action sets the session cookies on its own response and
      // redirects into the app — control only comes back here on failure.
      const result = await verifyEmailCode(email, code);
      if (result && !result.ok) {
        setCodeError(
          result.error === "code-expired"
            ? dict.auth.codeExpired
            : result.error === "code-format"
              ? dict.auth.codeInvalid
              : dict.auth.codeError,
        );
      }
    } catch {
      setCodeError(dict.auth.codeError);
    } finally {
      setIsVerifying(false);
    }
  };

  // Re-send to the SAME address (a fresh code + link). Neutral like the first
  // send — a resend can never become an is-this-address-invited oracle.
  const handleResend = async () => {
    setCodeError(null);
    setResent(false);
    setCode("");
    setIsLoading(true);
    try {
      const result = await requestSignInLink(email, locale);
      if (result.ok) setResent(true);
      else setCodeError(dict.auth.errorGeneric);
    } catch {
      setCodeError(dict.auth.errorGeneric);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // Server action: the allowlist gate + OTP send happen server-side. The
      // result is oracle-free — { ok: true } for any well-formed address whether
      // or not it's invited; { ok: false } only for a malformed address.
      const result = await requestSignInLink(email, locale);
      if (result.ok) {
        setSent(true);
      } else {
        setError(dict.auth.errorGeneric);
      }
    } catch {
      setError(dict.auth.errorGeneric);
    } finally {
      setIsLoading(false);
    }
  };

  if (sent) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <CheckCircle2
              className="size-6 text-success"
              aria-hidden="true"
            />
            {dict.auth.checkEmailTitle}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground" role="status">
            {t(dict.auth.checkEmailBody, { email })}
          </p>

          {/* The CODE leads; the emailed link is the demoted fallback (see the
              component comment — the link path strands sign-in in an email
              app's in-app webview; the code keeps it in this browser). */}
          <form onSubmit={handleVerify} className="flex flex-col gap-3" noValidate>
            <div className="grid gap-2">
              <Label htmlFor="otp-code">{dict.auth.codeLabel}</Label>
              <Input
                id="otp-code"
                name="code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                maxLength={6}
                value={code}
                onChange={(e) =>
                  setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                aria-describedby="code-link-hint"
                className="text-center font-mono text-2xl tracking-[0.35em]"
              />
            </div>

            {codeError && (
              <p className="text-sm text-red-700 dark:text-red-400" role="alert">
                {codeError}
              </p>
            )}
            {resent && !codeError && (
              <p className="text-sm text-success" role="status">
                {dict.auth.codeResent}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={isVerifying}>
              {isVerifying ? dict.auth.codeVerifying : dict.auth.codeVerify}
            </Button>
          </form>

          <p
            id="code-link-hint"
            className="text-center text-xs text-muted-foreground"
          >
            {dict.auth.orTapLink}
          </p>

          <div className="flex flex-col gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={handleResend}
              disabled={isLoading || isVerifying}
            >
              {isLoading ? dict.auth.submitting : dict.auth.codeResend}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setSent(false);
                setEmail("");
                setCode("");
                setCodeError(null);
                setResent(false);
              }}
            >
              {dict.auth.sendAnother}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">{dict.auth.title}</CardTitle>
        <CardDescription>{dict.auth.subtitle}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
          <div className="grid gap-2">
            <Label htmlFor="email">{dict.auth.emailLabel}</Label>
            <Input
              id="email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder={dict.auth.emailPlaceholder}
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-describedby="email-privacy-note"
            />
          </div>

          {error && (
            <p className="text-sm text-red-700 dark:text-red-400" role="alert">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? dict.auth.submitting : dict.auth.submit}
          </Button>

          <p
            id="email-privacy-note"
            className="text-center text-xs text-muted-foreground"
          >
            {dict.auth.privacyNote}
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
