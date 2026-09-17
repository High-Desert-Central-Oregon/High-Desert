import { pc } from "@/lib/member-pipelines/copy";
import { providerEnabled } from "@/lib/member-pipelines/server";
import { startProvider } from "@/app/auth/provider/actions";
export function ProviderButtons({
  locale,
  connect = false,
  connected = [],
}: {
  locale: string;
  connect?: boolean;
  connected?: string[];
}) {
  const google = providerEnabled("google") && !connected.includes("google");
  const apple = providerEnabled("apple") && !connected.includes("apple");
  if (!google && !apple) return null;
  return (
    <section className="flex flex-col gap-3">
      {google && (
        <form action={startProvider.bind(null, "google", connect)}>
          <button className="min-h-11 w-full rounded border bg-background px-4 font-semibold">
            {pc(locale, connect ? "connectGoogle" : "google")}
          </button>
        </form>
      )}
      {apple && (
        <form action={startProvider.bind(null, "apple", connect)}>
          <button className="min-h-11 w-full rounded border bg-background px-4 font-semibold">
            {pc(locale, connect ? "connectApple" : "apple")}
          </button>
        </form>
      )}
      {apple && !connect && (
        <p className="text-xs text-muted-foreground">
          {pc(locale, "appleHint")}
        </p>
      )}
    </section>
  );
}
