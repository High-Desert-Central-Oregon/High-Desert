import { createClient } from "@/lib/supabase/server";
import { type EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  // Default landing after a verified magic link. The protected area then routes
  // members who haven't accepted the current Terms to the consent gate.
  //
  // Only ever forward to an INTERNAL path: an attacker-supplied absolute
  // ("https://evil.com") or protocol-relative ("//evil.com") `next` would turn
  // this confirm route into an open redirect, so anything that isn't a plain
  // "/path" falls back to /protected. (The app itself always sends next=/protected.)
  const nextParam = searchParams.get("next") ?? "/protected";
  const next =
    nextParam.startsWith("/") && !nextParam.startsWith("//")
      ? nextParam
      : "/protected";

  if (token_hash && type) {
    const supabase = await createClient();

    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    });
    if (!error) {
      // redirect user to the (validated, internal) next path
      redirect(next);
    } else {
      // Surface the failure; encode so a message with & or # can't corrupt the URL.
      redirect(`/auth/error?error=${encodeURIComponent(error.message)}`);
    }
  }

  // redirect the user to an error page with some instructions
  redirect(`/auth/error?error=${encodeURIComponent("No token hash or type")}`);
}
