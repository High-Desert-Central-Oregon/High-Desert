import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hasEnvVars } from "../utils";
import { isCampaignSlug } from "../campaign-slugs";

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
    pathname === "/legal/privacy" ||
    pathname === "/legal/terms" ||
    pathname === "/q" ||
    pathname === "/p" ||
    pathname === "/d" ||
    pathname === "/e" ||
    pathname === "/c" ||
    pathname === "/s" ||
    pathname === "/contact" ||
    // Neighborhood pledge pages (migration 0026). These are the destination of
    // every printed QR code, mailer, and yard sign, so they must be readable by
    // someone with no account — and must stay reachable while LAUNCH_PHASE is
    // still "prelaunch", since the whole point is that they run BEFORE the
    // member app opens in that neighborhood. Prefix match: /n/<slug> and the
    // /n/<slug>/leave removal-confirmation page.
    pathname.startsWith("/n/");
  // Public endpoints reachable by anonymous visitors (the /join and /contact
  // forms post here; the landing hero polls /api/weather — a keyless, cached
  // public-data proxy that sends no user data upstream); each enforces its own
  // rules server-side.
  const isPublicApi =
    pathname === "/api/interest" ||
    pathname === "/api/contact" ||
    pathname === "/api/qr" ||
    pathname === "/api/weather" ||
    // Pledge submission + removal. Public by necessity (the pledger has no
    // account and never will before the neighborhood opens); each enforces its
    // own rules server-side, and the underlying RPCs are service_role-only so
    // this route is the only door.
    pathname === "/api/pledge" ||
    pathname === "/api/pledge/remove" ||
    // Calendar subscription feeds (C1 §6.1): polled by calendar apps with no
    // cookies or headers — the 256-bit bearer token in the path is the whole
    // credential, enforced by the service_role-only RPC behind the route.
    // Must bypass BOTH the auth redirect and the launch-phase gate (a member
    // could connect a feed during the beta while the site is prelaunch).
    pathname.startsWith("/cal/");
  const isStaticAsset =
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    // PWA install chain — both are static, carry no user data, and MUST load
    // unauthenticated in every launch phase, or the auth/launch gate below would
    // redirect them and installation would silently fail:
    //   • /sw.js — the service worker script. The browser (re)fetches it to
    //     register and to check for updates; a redirect here breaks the SW.
    //   • /manifest.webmanifest — the web app manifest (app/manifest.ts). Chrome
    //     must read it (name, icons, start_url) to offer install.
    pathname === "/sw.js" ||
    pathname === "/manifest.webmanifest" ||
    // The /preview embed (a self-contained app bundle under public/preview-app)
    // is part of the public marketing surface, so it must load even in the
    // prelaunch phase — otherwise the launch gate below redirects the iframe's
    // .html request to "/" and the preview shows the landing page instead.
    pathname.startsWith("/preview-app/") ||
    /\.(?:svg|png|jpg|jpeg|gif|webp|ico)$/.test(pathname);

  if (isPublicMarketing || isPublicApi || isStaticAsset) {
    // Unknown neighborhood slugs get a REAL 404 here, because this is the last
    // place that can still set one. Under cacheComponents the page cannot: every
    // uncached read must sit behind <Suspense>, so Next commits a 200 and
    // flushes a shell before any in-page slug check runs, leaving notFound()
    // able to change only the body. Both segment configs that would express
    // "this param does not exist" (`dynamic`, `dynamicParams`) are rejected
    // outright by cacheComponents, and generateStaticParams without
    // dynamicParams still renders unknown params on demand.
    //
    // Only the campaign page itself is gated. /n/<slug>/leave is deliberately
    // left open: someone holding a removal token for a campaign that has since
    // closed must still be able to remove themselves, and a 404 there would
    // trap their address in a list they asked to leave.
    const n = pathname.startsWith("/n/") ? pathname.split("/") : null;
    if (n && n.length === 3 && n[2]) {
      // null means "could not determine" — fail open (see lib/campaign-slugs).
      const known = await isCampaignSlug(n[2]);
      if (known === false) {
        return NextResponse.rewrite(new URL("/n-not-found", request.url), { status: 404 });
      }
    }
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
