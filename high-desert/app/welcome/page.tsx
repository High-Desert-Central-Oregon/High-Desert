import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { PageSkeleton } from "@/components/page-skeleton";
import { TermsGate } from "./terms-gate";
import { DocumentBody } from "@/components/document-body";
import { LanguageSwitcher } from "@/components/language-switcher";
import { LogoutButton } from "@/components/logout-button";
import { Lockup } from "@/components/wordmark";
import { getCurrentUser } from "@/lib/auth";
import { getConsentState } from "@/lib/onboarding";
import { getServerDictionary } from "@/lib/i18n/server";
import { t } from "@/lib/i18n";

export const metadata = {
  title: "Welcome · Steppe",
};

async function WelcomeContent() {
  // The proxy already keeps anonymous visitors out; this is defense in depth.
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");

  // If they've already agreed to the current documents, don't make them re-read.
  const { currentDocs, hasConsentedAll } = await getConsentState();
  if (hasConsentedAll) redirect("/protected");

  const { locale, dict } = await getServerDictionary();

  return (
    <main
      id="main"
      lang={locale}
      className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8 sm:py-12"
    >
      <header className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <Lockup
            name={dict.app.name}
            descriptor={dict.app.descriptor}
            lang={locale}
          />
          <LanguageSwitcher current={locale} />
        </div>

        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {dict.welcome.title}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {dict.welcome.intro}
          </p>
        </div>

        {/* The Terms & Privacy are a draft pending Oregon legal review — never
            present them as final (CLAUDE.md "Open items"). */}
        <div
          role="note"
          className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm text-warning"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{dict.welcome.draftNotice}</span>
        </div>

        <p className="text-xs text-muted-foreground">
          {t(dict.welcome.signedInAs, { email: user.email ?? "" })}{" "}
          <span className="inline-flex items-center gap-2">
            {dict.welcome.notYou} <LogoutButton label={dict.nav.signOut} />
          </span>
        </p>
      </header>

      <TermsGate dict={dict}>
        {currentDocs.map((doc) => (
          <section
            key={doc.id}
            aria-label={doc.kind}
            className="border-b pb-6 last:border-b-0 last:pb-0 [&+section]:pt-6"
          >
            <p className="mb-2 font-mono text-xs uppercase tracking-wider text-muted-foreground">
              {t(dict.welcome.versionLine, { version: doc.version })}
            </p>
            <DocumentBody body={doc.body} />
          </section>
        ))}
      </TermsGate>
    </main>
  );
}

export default function WelcomePage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:py-12">
          <PageSkeleton />
        </main>
      }
    >
      <WelcomeContent />
    </Suspense>
  );
}
