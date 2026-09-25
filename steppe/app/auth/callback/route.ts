import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeReturnPath } from "@/lib/member-pipelines/shared";
import { pipelinesEnabled } from "@/lib/member-pipelines/server";
import { providerIssue } from "@/lib/member-pipelines/auth-issue";
export async function GET(request: Request) {
  const url = new URL(request.url);
  const store = await cookies();
  const raw = store.get("steppe-auth-intent")?.value;
  store.delete("steppe-auth-intent");
  const fail = (code?: string) =>
    NextResponse.redirect(
      new URL(`/auth/login?issue=${providerIssue(code)}`, url.origin),
    );
  if (!pipelinesEnabled() || !raw) return fail();
  let intent: { returnTo?: string; expectedUser?: string };
  try {
    intent = JSON.parse(raw);
  } catch {
    return fail();
  }
  if (
    !intent ||
    typeof intent !== "object" ||
    (intent.expectedUser !== undefined &&
      typeof intent.expectedUser !== "string")
  )
    return fail();
  if (url.searchParams.has("error") || url.searchParams.has("error_code"))
    return fail(url.searchParams.get("error_code") ?? undefined);
  if (!url.searchParams.get("code")) return fail();
  const db = await createClient();
  const { data, error } = await db.auth.exchangeCodeForSession(
    url.searchParams.get("code")!,
  );
  if (error || !data.user) return fail(error?.code);
  if (intent.expectedUser && data.user.id !== intent.expectedUser) {
    await db.auth.signOut({ scope: "local" });
    return fail();
  }
  return NextResponse.redirect(
    new URL(safeReturnPath(intent.returnTo), url.origin),
  );
}
