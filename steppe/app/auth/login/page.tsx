import { Suspense } from "react";
import Link from "next/link";
import { MagicLinkForm } from "@/components/magic-link-form";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Lockup } from "@/components/wordmark";
import { getServerDictionary } from "@/lib/i18n/server";
import { ProviderButtons } from "@/components/member-pipelines/provider-buttons";
import { pc } from "@/lib/member-pipelines/copy";
import { pipelinesEnabled } from "@/lib/member-pipelines/server";

export const metadata = {
  title: "Sign in · Steppe",
};

async function LoginCard({searchParams}:{searchParams:Promise<{issue?:string}>}) {
  const { locale, dict } = await getServerDictionary();
  const issue=(await searchParams).issue;
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
        {pipelinesEnabled() && <><ProviderButtons locale={locale}/>{issue&&<p role="alert">{pc(locale,"authFailed")}</p>}<nav className="flex flex-wrap gap-4 text-sm"><Link className="underline" href="/join">{pc(locale,"joinList")}</Link><Link className="underline" href="/invite">{pc(locale,"acceptInvite")}</Link></nav></>}
      </div>
    </main>
  );
}

export default function LoginPage(props:{searchParams:Promise<{issue?:string}>}) {
  return (
    <Suspense>
      <LoginCard {...props}/>
    </Suspense>
  );
}
