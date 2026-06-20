import { Suspense } from "react";
import { PageSkeleton } from "@/components/page-skeleton";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";
import { getServerDictionary } from "@/lib/i18n/server";
import { DeleteAccount } from "./delete-account";

/**
 * The member's own account: take your data, or take it and leave (invariant 8,
 * Pattern 16). Export is a download link (the route streams the file); deletion
 * is the deliberate, confirmed flow in <DeleteAccount/>. Both are pinned to the
 * acting member server-side — the page is only the doorway.
 */
async function AccountView() {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");
  const { locale, dict } = await getServerDictionary();

  return (
    <div lang={locale} className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          {dict.account.title}
        </h1>
        <p className="text-sm text-muted-foreground">{dict.account.intro}</p>
      </header>

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
