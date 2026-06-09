import { Suspense } from "react";
import Link from "next/link";
import { getServerDictionary } from "@/lib/i18n/server";
import { t } from "@/lib/i18n";

export const metadata = {
  title: "Error · High Desert",
};

async function ErrorCard({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { locale, dict } = await getServerDictionary();
  const params = await searchParams;

  return (
    <main
      id="main"
      lang={locale}
      className="flex min-h-svh w-full flex-col items-center justify-center gap-6 p-6 md:p-10"
    >
      <div className="flex w-full max-w-sm flex-col gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">
          {dict.common.somethingWrong}
        </h1>
        <p className="text-sm text-muted-foreground">
          {params?.error
            ? t(dict.auth.errorCode, { code: params.error })
            : dict.auth.errorBody}
        </p>
        <Link
          href="/auth/login"
          className="text-sm text-primary underline-offset-2 hover:underline"
        >
          {dict.auth.backToSignIn}
        </Link>
      </div>
    </main>
  );
}

export default function Page({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  return (
    <Suspense>
      <ErrorCard searchParams={searchParams} />
    </Suspense>
  );
}
