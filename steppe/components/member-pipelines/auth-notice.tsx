"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { pc } from "@/lib/member-pipelines/copy";
import { fragmentIssue } from "@/lib/member-pipelines/auth-issue";

export function AuthNotice({
  locale,
  issue,
}: {
  locale: string;
  issue?: string;
}) {
  const [browserIssue, setBrowserIssue] = useState<string | null>(null);
  useEffect(() => {
    // Supabase may return errors in a fragment, which survives the callback's
    // redirect but is invisible to the server. Consume it only on a failed flow.
    if (issue !== "provider") return;
    const result = fragmentIssue(window.location.hash);
    if (!result) return;
    setBrowserIssue(result);
    const clean = new URL(window.location.href);
    clean.hash = "";
    clean.searchParams.set("issue", result);
    window.history.replaceState(
      window.history.state,
      "",
      clean.pathname + clean.search,
    );
  }, [issue]);

  if (!issue) return null;
  const conflict = (browserIssue ?? issue) === "identity-linked";
  return (
    <div className="space-y-3 text-sm">
      <p role="alert">
        {pc(locale, conflict ? "authIdentityLinked" : "authFailed")}
      </p>
      {conflict && (
        <Link
          className="focus-ring inline-flex min-h-11 items-center underline"
          href="/protected/account/sign-in-methods"
        >
          {pc(locale, "returnSignInMethods")}
        </Link>
      )}
    </div>
  );
}
