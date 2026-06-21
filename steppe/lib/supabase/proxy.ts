import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hasEnvVars } from "../utils";

export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public-first short-circuit: the marketing layer (the app/(site) route group)
  // and static assets are fully public, so bail out BEFORE creating a Supabase
  // client or calling getClaims(). This guarantees public requests make zero
  // auth/DB calls. "/" is the marketing landing; /partners, /preview, /join, and
  // /privacy are its sibling pages.
  const isPublicMarketing =
    pathname === "/" ||
    pathname === "/partners" ||
    pathname === "/preview" ||
    pathname === "/join" ||
    pathname === "/privacy" ||
    pathname === "/legal/privacy";
  // The public interest-signup endpoint must be reachable by anonymous visitors
  // (the /join form posts here); it enforces its own rules server-side.
  const isPublicApi = pathname === "/api/interest";
  const isStaticAsset =
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    /\.(?:svg|png|jpg|jpeg|gif|webp|ico)$/.test(pathname);

  if (isPublicMarketing || isPublicApi || isStaticAsset) {
    return NextResponse.next({ request });
  }

  // Launch-phase gate. LAUNCH_PHASE defaults to "prelaunch"; only the literal
  // "live" opens the member app. While not live, everything that isn't on the
  // public allowlist above — including /auth/* and /protected/* — redirects to
  // the marketing landing, so the member surface stays dormant before go-live.
  const launchPhase = process.env.LAUNCH_PHASE ?? "prelaunch";
  if (launchPhase !== "live") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  let supabaseResponse = NextResponse.next({
    request,
  });

  // If the env vars are not set, skip proxy check. You can remove this
  // once you setup the project.
  if (!hasEnvVars) {
    return supabaseResponse;
  }

  // With Fluid compute, don't put this client in a global environment
  // variable. Always create a new one on each request.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Do not run code between createServerClient and
  // supabase.auth.getClaims(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  // IMPORTANT: If you remove getClaims() and you use server-side rendering
  // with the Supabase client, your users may be randomly logged out.
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;

  // Public marketing routes already returned above; everything that reaches here
  // is gated. Auth pages themselves stay reachable so sign-in can complete.
  if (
    !user &&
    !pathname.startsWith("/login") &&
    !pathname.startsWith("/auth")
  ) {
    // no user, potentially respond by redirecting the user to the login page
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    return NextResponse.redirect(url);
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is.
  // If you're creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so:
  //    const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so:
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object to fit your needs, but avoid changing
  //    the cookies!
  // 4. Finally:
  //    return myNewResponse
  // If this is not done, you may be causing the browser and server to go out
  // of sync and terminate the user's session prematurely!

  return supabaseResponse;
}
