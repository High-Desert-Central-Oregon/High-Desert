"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Lockup } from "@/components/wordmark";
import {
  defaultLocale,
  getClientLocale,
  getDictionary,
  type Locale,
} from "@/lib/i18n";

/**
 * App-wide error boundary — catches a render/data error in any route segment and
 * shows a calm, branded recovery screen instead of a blank page or a raw stack.
 * Must be a client component (Next requirement), so it localizes from the
 * language cookie read on the client: it starts in English so the first render
 * stays hydration-stable, then picks up the member's choice on mount. Offers a
 * retry (reset()) and a way home. The raw error goes to logs, never the member.
 *
 * (The minimal root layout itself isn't covered by this boundary; see the report
 * for why a global-error.tsx was judged unnecessary.)
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [locale, setLocale] = useState<Locale>(defaultLocale);
  useEffect(() => {
    setLocale(getClientLocale());
    console.error(error);
  }, [error]);
  const dict = getDictionary(locale);

  return (
    <main
      id="main"
      lang={locale}
      className="flex min-h-svh w-full flex-col items-center justify-center gap-6 p-6"
    >
      <Lockup
        name={dict.app.name}
        descriptor={dict.app.descriptor}
        lang={locale}
        className="items-center text-center"
      />
      <Card className="w-full max-w-md">
        <CardHeader>
          <h1 className="text-2xl font-semibold tracking-tight">
            {dict.error.title}
          </h1>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{dict.error.body}</p>
        </CardContent>
        <CardFooter className="flex flex-wrap gap-3">
          <Button type="button" onClick={() => reset()}>
            {dict.error.retry}
          </Button>
          <Button asChild variant="outline">
            <Link href="/protected">{dict.error.back}</Link>
          </Button>
        </CardFooter>
      </Card>
    </main>
  );
}
