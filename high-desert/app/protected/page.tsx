import { Suspense } from "react";
import Link from "next/link";
import { CheckCircle2, Clock, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, getMyProfile } from "@/lib/auth";
import { getServerDictionary } from "@/lib/i18n/server";
import { t } from "@/lib/i18n";

async function Home() {
  const { locale, dict } = await getServerDictionary();
  const profile = await getMyProfile();
  const name = profile?.display_name ?? "";
  const verified = profile?.verified ?? false;

  // Resolve neighborhood name from the ID on the profile, if set.
  let neighborhoodName: string | null = null;
  if (profile?.neighborhood_id) {
    const user = await getCurrentUser();
    if (user) {
      const supabase = await createClient();
      const { data } = await supabase
        .from("neighborhoods")
        .select("name")
        .eq("id", profile.neighborhood_id)
        .maybeSingle<{ name: string }>();
      neighborhoodName = data?.name ?? null;
    }
  }

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

      <div className="flex flex-col gap-3">
        {/* Membership status */}
        <section
          aria-label={dict.home.statusLabel}
          className="flex items-center gap-3 rounded-lg border bg-card p-4"
        >
          {verified ? (
            <CheckCircle2
              className="size-5 shrink-0 text-green-600 dark:text-green-500"
              aria-hidden="true"
            />
          ) : (
            <Clock className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          )}
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-medium">{dict.home.statusLabel}</p>
            <p className="text-muted-foreground">
              {verified ? dict.home.statusVerified : dict.home.statusUnverified}
            </p>
          </div>
        </section>

        {/* Neighborhood */}
        <section
          aria-label={dict.home.neighborhoodLabel}
          className="flex items-center gap-3 rounded-lg border bg-card p-4"
        >
          <MapPin
            className="size-5 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-medium">{dict.home.neighborhoodLabel}</p>
            <p className="text-muted-foreground">
              {neighborhoodName ?? dict.home.noNeighborhood}
            </p>
          </div>
          <Button asChild variant="ghost" size="sm" className="shrink-0">
            <Link href="/protected/neighborhoods">
              {neighborhoodName
                ? dict.home.changeCta
                : dict.home.neighborhoodCta}
            </Link>
          </Button>
        </section>
      </div>

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
