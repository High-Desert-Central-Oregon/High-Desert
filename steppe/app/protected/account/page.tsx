import { Suspense } from "react";
import Link from "next/link";
import { PageSkeleton } from "@/components/page-skeleton";
import { redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, getMyProfile } from "@/lib/auth";
import { getServerDictionary } from "@/lib/i18n/server";
import { t } from "@/lib/i18n";
import { DeleteAccount } from "./delete-account";
import { SignOutButton } from "./sign-out-button";

/**
 * The YOU surface (preview-nav-spec §4, adopted): identity up top — the
 * member's name with a mono dateline (neighborhood · member since) — then the
 * app's sections as plain hairline rows: Neighborhood, Verify (until
 * verified), the role-gated moderation surfaces (Reviews · Appeals —
 * plumbing, not primary nav), the data-export and delete flows (invariant 8,
 * Pattern 16), and Sign out LAST, rust. Bundle sections that depend on unbuilt
 * features (Posts · Saved · Membership · Settings) are deliberately absent —
 * no dead rows.
 */
async function AccountView() {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");
  const { locale, dict } = await getServerDictionary();
  const profile = await getMyProfile();
  const isMod = profile?.role === "moderator" || profile?.role === "admin";
  const verified = profile?.verified ?? false;

  // Neighborhood name for the identity dateline (member since = profile row age).
  let neighborhood: string | null = null;
  if (profile?.neighborhood_id) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("neighborhoods")
      .select("name")
      .eq("id", profile.neighborhood_id)
      .maybeSingle();
    neighborhood = data?.name ?? null;
  }
  const since = profile?.created_at
    ? t(dict.review.memberSince, {
        date: String(new Date(profile.created_at).getFullYear()),
      })
    : null;
  const dateline = [neighborhood, since].filter(Boolean).join(" · ");

  const rows: { href: string; label: string }[] = [
    { href: "/protected/neighborhoods", label: dict.nav.neighborhoodLink },
    ...(!verified
      ? [{ href: "/protected/verify", label: dict.nav.verifyLink }]
      : []),
    ...(isMod
      ? [
          { href: "/protected/review", label: dict.nav.reviewLink },
          { href: "/protected/moderation", label: dict.nav.appealsLink },
        ]
      : []),
  ];

  return (
    <div lang={locale} className="flex flex-col gap-8">
      {/* Identity — the bundle's You masthead (name + dateline), on the page. */}
      <header className="flex flex-col gap-2">
        <h1 className="font-serif text-2xl font-semibold tracking-tight">
          {profile?.display_name ?? dict.account.title}
        </h1>
        {dateline && (
          <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
            {dateline}
          </p>
        )}
        <p className="text-sm text-muted-foreground">{dict.account.intro}</p>
      </header>

      {/* Sections — plain hairline rows. Reviews/Appeals appear for moderators
          only (moderation plumbing filed under You, not primary nav). */}
      <nav aria-label={dict.nav.accountLink}>
        <ul className="flex flex-col divide-y border-y">
          {rows.map((r) => (
            <li key={r.href}>
              <Link
                href={r.href}
                className="flex items-center justify-between py-3 text-sm hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <span>{r.label}</span>
                <ChevronRight className="size-4 text-accent" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <section className="flex flex-col gap-3 rounded-lg border bg-card p-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold">{dict.account.exportHeading}</h2>
          <p className="text-sm text-muted-foreground">
            {dict.account.exportBody}
          </p>
        </div>
        {/* A plain link: the route sets Content-Disposition: attachment, so it
            downloads rather than navigates. */}
        <Button asChild variant="secondary" className="self-start">
          <a href="/protected/account/export" download>
            {dict.account.exportButton}
          </a>
        </Button>
      </section>

      <DeleteAccount dict={dict} />

      {/* Sign out — last, rust (the bundle's ySignout). */}
      <SignOutButton label={dict.nav.signOut} />
    </div>
  );
}

export default function AccountPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <AccountView />
    </Suspense>
  );
}
