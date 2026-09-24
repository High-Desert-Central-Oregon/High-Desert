import { pc } from "@/lib/member-pipelines/copy";
import { providerEnabled } from "@/lib/member-pipelines/server";
import { startProvider } from "@/app/auth/provider/actions";

const buttonClassName =
  "focus-ring flex min-h-11 w-full items-center justify-center gap-2.5 rounded border border-[#747775] bg-white px-3 py-2.5 text-sm font-medium text-[#1f1f1f] hover:bg-[#f2f2f2] active:bg-[#e5e5e5]";

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
          <button type="submit" className={buttonClassName}>
            {/* Small, local brand artwork needs no image transformation. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/auth/google.png"
              alt=""
              aria-hidden="true"
              width={20}
              height={20}
              className="h-5 w-5 shrink-0 object-contain"
            />
            <span>{pc(locale, connect ? "connectGoogle" : "google")}</span>
          </button>
        </form>
      )}
      {apple && (
        <form action={startProvider.bind(null, "apple", connect)}>
          <button type="submit" className={buttonClassName}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/auth/apple.svg"
              alt=""
              aria-hidden="true"
              width={20}
              height={20}
              className="h-5 w-5 shrink-0 object-contain"
            />
            <span>{pc(locale, connect ? "connectApple" : "apple")}</span>
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
