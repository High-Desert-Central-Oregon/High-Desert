import { isSupportOperator } from "@/lib/bug-reports/server";
import { bugCopy } from "@/lib/bug-reports/copy";
import { Suspense } from "react";
import Link from "next/link";
import { PageSkeleton } from "@/components/page-skeleton";
import { redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { Masthead } from "@/components/broadsheet/masthead";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, getMyProfile } from "@/lib/auth";
import { getServerDictionary } from "@/lib/i18n/server";
import { t } from "@/lib/i18n";
import { DeleteAccount } from "./delete-account";
import { SignOutButton } from "./sign-out-button";
import { InstallRow } from "./install-row";

function initials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0] ?? "")
      .join("")
      .toUpperCase() || "S"
  );
}

/**
 * The YOU surface (preview-nav-spec §4, adopted): identity up top — the
 * member's name with a mono dateline (neighborhood · member since), followed
 * by the preview's identity card, privacy note, and compact hairline rows.
 * Every row maps to a shipped route or action. Preview-only sections that still
 * have no product behind them stay absent, so parity never creates dead doors.
 */
async function AccountView() {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");
  const { locale, dict } = await getServerDictionary();
  const profile = await getMyProfile();
  const isMod = profile?.role === "moderator" || profile?.role === "admin";
  const verified = profile?.verified ?? false;
  const supportOperator = await isSupportOperator();

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
  const displayName = profile?.display_name ?? dict.account.title;
  const identityMeta = [
    neighborhood,
    verified ? dict.account.verifiedMeta : dict.account.unverifiedMeta,
  ]
    .filter(Boolean)
    .join(" · ");

  const rows: {
    href: string;
    label: string;
    sub?: string;
    download?: boolean;
  }[] = [
    ...(supportOperator
      ? [{ href: "/protected/support", label: bugCopy[locale].queue }]
      : []),
    ...(!verified
      ? [
          {
            href: "/protected/verify",
            label: dict.nav.verifyLink,
            sub: dict.account.verifyRowSub,
          },
        ]
      : []),
    {
      href: "/protected/groups",
      label: dict.account.groupsRow,
      sub: dict.account.groupsRowSub,
    },
    {
      href: "/protected/governance",
      label: dict.account.governanceRow,
      sub: dict.account.governanceRowSub,
    },
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
    {
      href: "/protected/neighborhoods",
      label: dict.nav.neighborhoodLink,
      sub: dict.account.neighborhoodRowSub,
    },
    ...(isMod
      ? [
          { href: "/protected/review", label: dict.nav.reviewLink },
          { href: "/protected/moderation", label: dict.nav.appealsLink },
          { href: "/protected/invites", label: dict.nav.invitesLink },
        ]
      : []),
    {
      href: "/protected/account/export",
      label: dict.account.dataRow,
      sub: dict.account.dataRowSub,
      download: true,
    },
  ];

  return (
    <div lang={locale} className="flex flex-col gap-8">
      {/* Identity — the bundle's You masthead: name, dateline, privacy voice. */}
      <Masthead
        title={displayName}
        kicker={dateline || undefined}
        voice={dict.account.voice}
        flush
      />

      {/* The preview's identity block, now backed by the real member profile. */}
      <section className="flex flex-col gap-4 border-b-2 border-foreground pb-6">
        <div className="flex items-center gap-4">
          <span
            aria-hidden="true"
            className="flex size-14 shrink-0 items-center justify-center rounded-full bg-secondary font-mono text-base font-semibold text-foreground"
          >
            {initials(displayName)}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-serif text-2xl font-semibold leading-tight">
              {displayName}
            </h2>
            {identityMeta && (
              <p className="mt-1 font-mono text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
                {identityMeta}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-start gap-2.5 border bg-muted/60 px-3 py-2.5">
          <span
            aria-hidden="true"
            className="mt-1.5 size-2 shrink-0 rounded-full bg-secondary-foreground"
          />
          <p className="text-sm leading-relaxed text-muted-foreground">
            {verified
              ? dict.account.verifiedPrivacyNote
              : dict.account.unverifiedPrivacyNote}
          </p>
        </div>

        <Link
          href="/protected/account/profile"
          className="self-start border px-3.5 py-2.5 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          {dict.account.editPublic}
        </Link>
      </section>

      {/* Shipped sections in the same compact row grammar as the preview.
          Reviews and Appeals remain role-gated under You. */}
      <nav aria-label={dict.nav.accountLink}>
        <ul className="flex flex-col divide-y border-y">
          {rows.map((r) => (
            <li key={r.href}>
              <Link
                href={r.href}
                download={r.download || undefined}
                className="flex items-center justify-between gap-4 py-4 text-sm hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <span className="flex min-w-0 flex-col">
                  <span className="font-semibold">{r.label}</span>
                  {r.sub && (
                    <span className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      {r.sub}
                    </span>
                  )}
                </span>
                <ChevronRight
                  className="size-4 text-accent"
                  aria-hidden="true"
                />
              </Link>
            </li>
          ))}
          {/* Add to home screen — the persistent install door. Ignores the
              banner's dismissal on purpose; renders nothing (no empty divider)
              on devices with no install path. */}
          <InstallRow dict={dict} />
        </ul>
      </nav>

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
