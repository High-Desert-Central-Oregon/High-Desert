"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
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
 * Passwordless sign-in / join. We send a one-time secure link by email
 * (`signInWithOtp`), so there is no password to remember or leak (Stack:
 * "No passwords to leak"). The same form both signs in returning members and
 * creates new accounts — `shouldCreateUser` plus the database `handle_new_user`
 * trigger bootstraps the profile server-side (invariant 2). We pass the chosen
 * locale as sign-up metadata so the new profile starts in the right language.
 *
 * After a successful request we show a neutral "check your email" state and do
 * not reveal whether the address already had an account.
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
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          // Land on the confirm route, which verifies the link and forwards on.
          // The protected area then routes first-time members to the Terms gate.
          emailRedirectTo: `${window.location.origin}/auth/confirm?next=/protected`,
          shouldCreateUser: true,
          data: { locale },
        },
      });
      if (error) throw error;
      setSent(true);
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
              className="size-6 text-green-600 dark:text-green-500"
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
