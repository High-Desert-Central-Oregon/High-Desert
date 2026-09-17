"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isProvider } from "@/lib/member-pipelines/shared";
import { providerEnabled } from "@/lib/member-pipelines/server";
import { siteOrigin } from "@/lib/site-url";
export async function startProvider(provider: string, connect: boolean) {
  if (
    typeof connect !== "boolean" ||
    !isProvider(provider) ||
    !providerEnabled(provider)
  )
    redirect("/auth/login?issue=provider");
  const db = await createClient();
  const store = await cookies();
  const returnTo = connect
    ? "/protected/account/sign-in-methods"
    : "/protected";
  let expectedUser = "";
  if (connect) {
    const { data, error } = await db.auth.getUser();
    if (error || !data.user) redirect("/auth/login");
    expectedUser = data.user.id;
  }
  store.set("steppe-auth-intent", JSON.stringify({ returnTo, expectedUser }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });
  const options = { redirectTo: `${siteOrigin()}/auth/callback` };
  const result = connect
    ? await db.auth.linkIdentity({ provider, options })
    : await db.auth.signInWithOAuth({ provider, options });
  if (result.error || !result.data.url) redirect("/auth/login?issue=provider");
  redirect(result.data.url);
}
