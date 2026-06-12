import { Suspense } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { getServerDictionary } from "@/lib/i18n/server";

/**
 * The branded 404 — covers both `notFound()` and any unmatched URL. Localized
 * server-side from the language cookie (wrapped in Suspense because that reads a
 * dynamic API). Plain neighborly voice, with one clear way back. Its own <main>
 * + <h1> keep the landmark/heading structure intact (these pages render inside
 * the minimal root layout, which provides no <main>).
 */
async function NotFoundCard() {
  const { locale, dict } = await getServerDictionary();
  return (
    <main
      id="main"
      lang={locale}
      className="flex min-h-svh w-full flex-col items-center justify-center gap-6 p-6"
    >
      <Card className="w-full max-w-md">
        <CardHeader>
          <h1 className="text-2xl font-semibold tracking-tight">
            {dict.notFound.title}
          </h1>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{dict.notFound.body}</p>
        </CardContent>
        <CardFooter>
          <Button asChild>
            <Link href="/protected">{dict.notFound.back}</Link>
          </Button>
        </CardFooter>
      </Card>
    </main>
  );
}

export default function NotFound() {
  return (
    <Suspense>
      <NotFoundCard />
    </Suspense>
  );
}
