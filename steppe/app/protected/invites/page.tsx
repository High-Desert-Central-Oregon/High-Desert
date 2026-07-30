import { Suspense } from "react";
import { redirect } from "next/navigation";
import { PageSkeleton } from "@/components/page-skeleton";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/auth";
import { getServerDictionary } from "@/lib/i18n/server";
import { formatRedmondDate } from "@/lib/time";
import { CANONICAL_ORIGIN } from "@/lib/site-url";
import { MintForm } from "./mint-form";
import { TokenRow } from "./token-row";

/**
 * Invitations (/protected/invites) — mint a capped token, print it, revoke it.
 *
 * MODERATOR-ONLY, twice over. This page redirects a non-moderator, and the
 * `invite_tokens_manage` RLS policy refuses the reads and writes regardless of
 * what any page renders (0027). The redirect is a flow gate; the policy is the
 * gate. A member who guesses the URL sees the app, not a roster.
 *
 * Ordered newest-first — chronological, never ranked (invariant 7). There is no
 * scoring, no "most effective token", and nothing here is an optimization target.
 *
 * WHAT THE TOKEN STRING IS DOING ON SCREEN. It is stored in plaintext on purpose
 * (0027, G-INV-3): a token is a distribution artifact meant to be printed,
 * reprinted, and read aloud, not a secret verified against a hash — a moderator
 * has to be able to re-read one to reprint a card. Expiry, the cap, revocation,
 * and this page being moderator-only are the controls.
 */
export const metadata = {
  title: "Invitations · Steppe",
};

type TokenRowData = {
  id: string;
  token: string;
  label: string | null;
  max_uses: number;
  uses_count: number;
  expires_at: string;
  revoked_at: string | null;
  created_at: string;
  neighborhood_id: string | null;
};

async function InvitesContent() {
  const profile = await getMyProfile();
  if (!profile) redirect("/auth/login");
  if (profile.role !== "moderator" && profile.role !== "admin") {
    redirect("/protected");
  }

  const { locale, dict } = await getServerDictionary();
  const supabase = await createClient();

  const [{ data: tokens }, { data: neighborhoods }] = await Promise.all([
    supabase
      .from("invite_tokens")
      .select(
        "id, token, label, max_uses, uses_count, expires_at, revoked_at, created_at, neighborhood_id",
      )
      .order("created_at", { ascending: false })
      .returns<TokenRowData[]>(),
    supabase
      .from("neighborhoods")
      .select("id, name")
      .order("name")
      .returns<{ id: string; name: string }[]>(),
  ]);

  const hoods = neighborhoods ?? [];
  const hoodName = new Map(hoods.map((h) => [h.id, h.name]));

  return (
    <div lang={locale} className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">{dict.invites.title}</h1>
        <p className="max-w-prose text-sm text-muted-foreground">
          {dict.invites.lead}
        </p>
      </header>

      <MintForm dict={dict} neighborhoods={hoods} origin={CANONICAL_ORIGIN} />

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{dict.invites.listTitle}</h2>
        {(tokens ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">{dict.invites.empty}</p>
        ) : (
          <ul className="flex flex-col divide-y border-y">
            {(tokens ?? []).map((tk) => (
              <li key={tk.id}>
                <TokenRow
                  dict={dict}
                  id={tk.id}
                  token={tk.token}
                  label={tk.label}
                  maxUses={tk.max_uses}
                  usesCount={tk.uses_count}
                  expiresAt={tk.expires_at}
                  expiresLabel={formatRedmondDate(tk.expires_at, locale)}
                  revoked={tk.revoked_at !== null}
                  neighborhood={
                    tk.neighborhood_id
                      ? hoodName.get(tk.neighborhood_id) ?? null
                      : null
                  }
                  origin={CANONICAL_ORIGIN}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default function InvitesPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <InvitesContent />
    </Suspense>
  );
}
