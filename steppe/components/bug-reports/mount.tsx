import { cookies } from "next/headers";
import { BugReporter } from "./reporter";
import { bugReportsEnabled, reportRelease } from "@/lib/bug-reports/server";
export async function BugReporting() {
  if (!bugReportsEnabled()) return null;
  const store = await cookies();
  return (
    <BugReporter
      appLocale={store.get("hd_locale")?.value === "es" ? "es" : "en"}
      siteLocale={store.get("NEXT_LOCALE")?.value === "es" ? "es" : "en"}
      release={reportRelease()}
    />
  );
}
