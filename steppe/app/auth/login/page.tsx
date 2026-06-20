import { Suspense } from "react";
import Link from "next/link";
import { MagicLinkForm } from "@/components/magic-link-form";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Lockup } from "@/components/wordmark";
import { getServerDictionary } from "@/lib/i18n/server";

export const metadata = {
  title: "Sign in · Steppe",
};

async function LoginCard() {
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
        <MagicLinkForm dict={dict} locale={locale} />
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginCard />
    </Suspense>
  );
}
