import { Suspense } from "react";
import { PageSkeleton } from "@/components/page-skeleton";
import Link from "next/link";
import { CheckCircle2, Clock, MapPin, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, getMyProfile } from "@/lib/auth";
import { getServerDictionary } from "@/lib/i18n/server";
import { t } from "@/lib/i18n";
import type { ModeratableTarget } from "@/lib/moderation";

type Notice = {
  targetType: ModeratableTarget;
  targetId: string;
  title: string;
  reason: string | null;
};

async function Home() {
  const { locale, dict } = await getServerDictionary();
  const profile = await getMyProfile();
  const user = await getCurrentUser();
  const name = profile?.display_name ?? "";
  const verified = profile?.verified ?? false;
  const supabase = user ? await createClient() : null;

  // Resolve neighborhood name from the ID on the profile, if set.
  let neighborhoodName: string | null = null;
  if (supabase && profile?.neighborhood_id) {
    const { data } = await supabase
      .from("neighborhoods")
      .select("name")
      .eq("id", profile.neighborhood_id)
      .maybeSingle<{ name: string }>();
    neighborhoodName = data?.name ?? null;
  }

  // Moderation notices: the member's OWN content that's currently removed, so
  // they learn of it and can appeal — moderation is never silent (P7). Showing
  // a member their own title doesn't re-expose anything (only they see this).
  const notices: Notice[] = [];
  if (supabase && user) {
    const [{ data: myEvents }, { data: myProposals }, { data: myPosts }] =
      await Promise.all([
        supabase.from("events").select("id, title").eq("creator_id", user.id),
        supabase.from("proposals").select("id, title").eq("author_id", user.id),
        supabase.from("posts").select("id, title").eq("author_id", user.id),
      ]);
    const titles = new Map<string, { type: ModeratableTarget; title: string }>();
    for (const e of myEvents ?? [])
      titles.set(e.id, { type: "event", title: e.title });
    for (const p of myProposals ?? [])
      titles.set(p.id, { type: "proposal", title: p.title });
    for (const po of myPosts ?? [])
      titles.set(po.id, { type: "post", title: po.title });

    if (titles.size > 0) {
      const { data: removed } = await supabase
        .from("content_moderation")
        .select("target_type, target_id, reason")
        .eq("action", "remove")
        .in("target_id", [...titles.keys()])
        .returns<{ target_type: string; target_id: string; reason: string | null }[]>();
      for (const r of removed ?? []) {
        const owned = titles.get(r.target_id);
        if (owned && owned.type === r.target_type) {
          notices.push({
            targetType: owned.type,
            targetId: r.target_id,
            title: owned.title,
            reason: r.reason,
          });
        }
      }
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

      {notices.length > 0 && (
        <section
          aria-label={dict.moderation.noticesTitle}
          className="flex flex-col gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4"
        >
          <div className="flex items-center gap-2">
            <Ban className="size-5 shrink-0 text-destructive" aria-hidden="true" />
            <h2 className="font-medium">{dict.moderation.noticesTitle}</h2>
          </div>
          <ul className="flex flex-col gap-3">
            {notices.map((n) => (
              <li key={n.targetId} className="text-sm">
                <p>
                  {t(
                    n.targetType === "event"
                      ? dict.moderation.noticeEventRemoved
                      : n.targetType === "post"
                        ? dict.moderation.noticePostRemoved
                        : dict.moderation.noticeProposalRemoved,
                    { title: n.title },
                  )}
                </p>
                {n.reason && (
                  <p className="text-muted-foreground">
                    {dict.moderation.removedReason}: {n.reason}
                  </p>
                )}
                <Link
                  href={`/protected/${
                    n.targetType === "event"
                      ? "events"
                      : n.targetType === "post"
                        ? "exchange"
                        : "governance"
                  }/${n.targetId}`}
                  className="text-primary underline-offset-2 hover:underline"
                >
                  {dict.moderation.noticeView}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex flex-col gap-3">
        {/* Membership status */}
        <section
          aria-label={dict.home.statusLabel}
          className="flex items-center gap-3 rounded-lg border bg-card p-4"
        >
          {verified ? (
            <CheckCircle2
              className="size-5 shrink-0 text-success"
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

      <p className="text-sm text-success">
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
    <Suspense fallback={<PageSkeleton />}>
      <Home />
    </Suspense>
  );
}
