import { Suspense } from "react";
import Link from "next/link";
import { PageSkeleton } from "@/components/page-skeleton";
import { redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { Masthead } from "@/components/broadsheet/masthead";
import { SectionLabel } from "@/components/broadsheet/section-row";
import { ActionLink } from "@/components/broadsheet/action-link";
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

  const rows: { href: string; label: string; sub?: string }[] = [
    {
      href: "/protected/account/profile",
      label: dict.account.profileRow,
      sub: dict.account.profileRowSub,
    },
    { href: "/protected/neighborhoods", label: dict.nav.neighborhoodLink },
    ...(!verified
      ? [{ href: "/protected/verify", label: dict.nav.verifyLink }]
      : []),
    // Messages (messages-m1-spec §6 — a secondary inbox entry beside the
    // header icon) and My Calendar (calendar-c1-spec §1.1): the You-row
    // grammar's optional sub line (bundle :733-743) says what fills each.
    {
      href: "/protected/messages",
      label: dict.messages.title,
      sub: dict.messages.rowSub,
    },
    {
      href: "/protected/account/calendar",
      label: dict.calendar.title,
      sub: dict.calendar.rowSub,
    },
    ...(isMod
      ? [
          { href: "/protected/review", label: dict.nav.reviewLink },
          { href: "/protected/moderation", label: dict.nav.appealsLink },
        ]
      : []),
  ];

  return (
    <div lang={locale} className="flex flex-col gap-8">
      {/* Identity — the bundle's You masthead: name, dateline, privacy voice. */}
      <Masthead
        title={profile?.display_name ?? dict.account.title}
        kicker={dateline || undefined}
        voice={dict.account.voice}
        flush
      />

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
                <span className="flex min-w-0 flex-col">
                  <span>{r.label}</span>
                  {r.sub && (
                    <span className="mt-0.5 text-xs text-muted-foreground">
                      {r.sub}
                    </span>
                  )}
                </span>
                <ChevronRight className="size-4 text-accent" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* Data export — boxed card becomes a hairline section with a mono
          action link (preview vocabulary). The route sets Content-Disposition,
          so the link downloads rather than navigates. */}
      <section className="flex flex-col gap-2 border-b pb-5">
        <SectionLabel>{dict.account.exportHeading}</SectionLabel>
        <p className="text-sm text-muted-foreground">{dict.account.exportBody}</p>
        <ActionLink
          href="/protected/account/export"
          label={dict.account.exportButton}
          download
        />
      </section>

      {/* Delete keeps its danger box — with the rust rule on top marking the
          consequential boundary. */}
      <div className="border-t-2 border-accent pt-6">
        <DeleteAccount dict={dict} />
      </div>

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
