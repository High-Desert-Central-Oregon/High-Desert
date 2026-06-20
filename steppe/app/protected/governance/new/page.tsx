import { Suspense } from "react";
import { PageSkeleton } from "@/components/page-skeleton";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ProposalForm } from "./proposal-form";
import { VerifiedGate } from "@/components/verified-gate";
import { getMyProfile } from "@/lib/auth";
import { getServerDictionary } from "@/lib/i18n/server";
import { redmondInputValue } from "@/lib/time";

export const metadata = {
  title: "New proposal · Steppe",
};

async function NewProposalContent() {
  const profile = await getMyProfile();
  if (!profile) redirect("/auth/login");

  const { locale, dict } = await getServerDictionary();

  if (!profile.verified) {
    return (
      <VerifiedGate
        title={dict.governance.gateTitle}
        body={dict.governance.gateBody}
        ctaLabel={dict.governance.gateCta}
        locale={locale}
      />
    );
  }

  // Prefill "opens" with the current Redmond wall-clock time, computed on the
  // server so the value is stable through hydration (no browser-clock drift).
  const defaultOpens = redmondInputValue(new Date());

  return (
    <div lang={locale} className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link
          href="/protected/governance"
          className="text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          {dict.governance.backToList}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          {dict.governance.newTitle}
        </h1>
        <p className="text-sm text-muted-foreground">
          {dict.governance.newIntro}
        </p>
      </div>

      <ProposalForm defaultOpens={defaultOpens} dict={dict} />
    </div>
  );
}

export default function NewProposalPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <NewProposalContent />
    </Suspense>
  );
}
