"use client";

import { useState } from "react";
import { requestSignInLink } from "@/app/auth/login/actions";
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
 * is sent a one-time link (and, if new, has its account created). The check runs
 * server-side so a tampered client can't skip it, and the database backstop
 * (`enforce_invited_signup`) refuses a non-allowlisted signup even against a
 * direct GoTrue call. There is no password to remember or leak.
 *
 * The action returns an identical neutral result for every well-formed address —
 * invited or not — so we always show the same "check your email" state and never
 * reveal whether an address is on the invite list (no enumeration oracle).
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
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setSent(false);
              setEmail("");
            }}
          >
            {dict.auth.sendAnother}
          </Button>
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
