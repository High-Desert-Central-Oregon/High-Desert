import { Suspense } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Lockup } from "@/components/wordmark";
import { getCurrentUser } from "@/lib/auth";
import { getServerDictionary } from "@/lib/i18n/server";

async function Landing() {
  const { locale, dict } = await getServerDictionary();
  const user = await getCurrentUser();

  return (
    <main
      id="main"
      lang={locale}
      className="mx-auto flex min-h-svh w-full max-w-3xl flex-col px-5"
    >
      <nav className="flex items-center justify-between py-3">
        <Lockup
          name={dict.app.name}
          descriptor={dict.app.descriptor}
          lang={locale}
        />
        <LanguageSwitcher current={locale} />
      </nav>

      <div className="flex flex-1 flex-col justify-center gap-10 py-12">
        <div className="flex flex-col gap-4">
          <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            {dict.app.place}
          </p>
          <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
            {dict.landing.title}
          </h1>
          <p className="max-w-prose text-pretty text-muted-foreground">
            {dict.landing.subtitle}
          </p>
          <div className="mt-2">
            <Button asChild size="lg">
              <Link href={user ? "/protected" : "/auth/login"}>
                {user ? dict.landing.dashboardCta : dict.landing.signInCta}
              </Link>
            </Button>
          </div>
        </div>

        <section aria-label={dict.landing.commitmentsTitle} className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-muted-foreground">
            {dict.landing.commitmentsTitle}
          </h2>
          <ul className="flex flex-col gap-2">
            {dict.landing.commitments.map((line) => (
              <li key={line} className="flex items-start gap-2 text-sm">
                <Check
                  className="mt-0.5 size-4 shrink-0 text-success"
                  aria-hidden="true"
                />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <footer className="border-t py-6 text-xs text-muted-foreground">
        {dict.app.name} · {dict.app.place}
      </footer>
    </main>
  );
}

export default function Home() {
  return (
    <Suspense>
      <Landing />
    </Suspense>
  );
}
