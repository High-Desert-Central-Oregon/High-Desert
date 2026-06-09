import { Suspense } from "react";
import { redirect } from "next/navigation";
import { CheckCircle2, Clock, ShieldCheck } from "lucide-react";
import { VerifyForm } from "./verify-form";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, getMyProfile } from "@/lib/auth";
import { getServerDictionary } from "@/lib/i18n/server";
import type { VerificationRow } from "@/lib/verification";

export const metadata = {
  title: "Verify residency · High Desert",
};

/** The member's most recent verification request, if any (own row via RLS). */
async function latestVerification(userId: string): Promise<VerificationRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("verifications")
    .select(
      "id, user_id, method, status, evidence_path, reviewed_by, reviewed_at, created_at",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<VerificationRow>();
  return data ?? null;
}

async function VerifyContent() {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");

  const { locale, dict } = await getServerDictionary();
  const profile = await getMyProfile();
  const latest = await latestVerification(user.id);

  // Already verified — nothing to do.
  if (profile?.verified) {
    return (
      <StatusCard
        lang={locale}
        tone="success"
        icon={<ShieldCheck className="size-6" aria-hidden="true" />}
        title={dict.verify.verifiedTitle}
        body={dict.verify.verifiedBody}
      />
    );
  }

  // A request is in the human-review queue.
  if (latest?.status === "pending") {
    return (
      <StatusCard
        lang={locale}
        tone="pending"
        icon={<Clock className="size-6" aria-hidden="true" />}
        title={dict.verify.pendingTitle}
        body={dict.verify.pendingBody}
      />
    );
  }

  // Not verified and nothing pending: show the form (with a note if the last
  // attempt was rejected).
  return (
    <div lang={locale} className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          {dict.verify.title}
        </h1>
        <p className="text-sm text-muted-foreground">{dict.verify.intro}</p>
      </header>

      <div className="flex items-start gap-2 rounded-md border bg-card p-3 text-sm text-muted-foreground">
        <CheckCircle2
          className="mt-0.5 size-4 shrink-0 text-green-600 dark:text-green-500"
          aria-hidden="true"
        />
        <span>{dict.verify.forget}</span>
      </div>

      {latest?.status === "rejected" && (
        <p
          role="status"
          className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
        >
          {dict.verify.rejectedNote}
        </p>
      )}

      <VerifyForm dict={dict} uid={user.id} />
    </div>
  );
}

function StatusCard({
  lang,
  tone,
  icon,
  title,
  body,
}: {
  lang: string;
  tone: "success" | "pending";
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  const toneClass =
    tone === "success"
      ? "text-green-700 dark:text-green-500"
      : "text-muted-foreground";
  return (
    <div lang={lang} className="flex flex-col gap-3 rounded-lg border bg-card p-6">
      <div className={`flex items-center gap-3 ${toneClass}`}>
        {icon}
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          {title}
        </h1>
      </div>
      <p className="text-sm text-muted-foreground">{body}</p>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense>
      <VerifyContent />
    </Suspense>
  );
}
