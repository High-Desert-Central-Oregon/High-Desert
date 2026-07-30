import Link from "next/link";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Lockup } from "@/components/wordmark";
import { getServerDictionary } from "@/lib/i18n/server";
import { RedeemPanel } from "./redeem-panel";

/**
 * The chrome around invite redemption, shared by /invite and /invite/<token>.
 *
 * Deliberately the same shell as /auth/login rather than the marketing shell:
 * this is the front door of the member app, not a page about Steppe, and the
 * two routes differ only in whether the code arrived in the URL. One shell so
 * they cannot drift into looking like different products.
 *
 * Uses lib/i18n (getServerDictionary) rather than next-intl, because that is
 * what /auth/login and MagicLinkForm use and this hands off to both. The
 * marketing layer under app/(site) uses next-intl; the boundary between the two
 * catalogs runs along the same line as the boundary between the two shells.
 */
export async function InviteShell({ token = "" }: { token?: string }) {
  const { locale, dict } = await getServerDictionary();
  return (
    <main
      id="main"
      lang={locale}
      className="flex min-h-svh w-full flex-col items-center justify-center gap-6 p-6 md:p-10"
    >
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex items-center justify-between">
          <Link href="/">
            <Lockup
              name={dict.app.name}
              descriptor={dict.app.descriptor}
              lang={locale}
            />
          </Link>
          <LanguageSwitcher current={locale} />
        </div>
        <RedeemPanel dict={dict} locale={locale} initialToken={token} />
        <p className="text-center text-xs text-muted-foreground">
          {dict.invite.alreadyMember}{" "}
          <Link href="/auth/login" className="underline underline-offset-4">
            {dict.invite.signInLink}
          </Link>
        </p>
      </div>
    </main>
  );
}
