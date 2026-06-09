import { Suspense } from "react";
import Link from "next/link";
import { CheckCircle2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getMyProfile } from "@/lib/auth";
import { getServerDictionary } from "@/lib/i18n/server";
import { t } from "@/lib/i18n";

async function Home() {
  const { locale, dict } = await getServerDictionary();
  const profile = await getMyProfile();
  const name = profile?.display_name ?? "";
  const verified = profile?.verified ?? false;

  return (
    <div lang={locale} className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          {dict.home.title}
        </h1>
        {name && (
          <p className="text-muted-foreground">
            {t(dict.home.greeting, { name })}
          </p>
        )}
      </header>

      <section
        aria-label={dict.home.statusLabel}
        className="flex items-center gap-3 rounded-lg border bg-card p-4"
      >
        {verified ? (
          <CheckCircle2
            className="size-5 text-green-600 dark:text-green-500"
            aria-hidden="true"
          />
        ) : (
          <Clock className="size-5 text-muted-foreground" aria-hidden="true" />
        )}
        <div className="text-sm">
          <p className="font-medium">{dict.home.statusLabel}</p>
          <p className="text-muted-foreground">
            {verified ? dict.home.statusVerified : dict.home.statusUnverified}
          </p>
        </div>
      </section>

      <p className="text-sm text-green-700 dark:text-green-500">
        {dict.home.consentRecorded}
      </p>

      <section className="rounded-lg border border-dashed p-5">
        <h2 className="font-medium">{dict.home.nextTitle}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{dict.home.nextBody}</p>
        {!verified && (
          <Button asChild className="mt-4">
            <Link href="/protected/verify">{dict.home.verifyCta}</Link>
          </Button>
        )}
      </section>
    </div>
  );
}

export default function ProtectedPage() {
  return (
    <Suspense>
      <Home />
    </Suspense>
  );
}
