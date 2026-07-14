import type { MetadataRoute } from 'next'

// If you already have a manifest, merge the `icons` array (and theme/background
// colors) into it rather than adding a second manifest.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Steppe',
    short_name: 'Steppe',
    description: 'A high desert civic commons for Redmond, Central Oregon.',
    // start_url MUST be a proxy-processed route (not '/'). Do NOT "simplify"
    // this back to '/':
    //   • The Supabase session lives in cookies that are httpOnly:false and
    //     JavaScript-writable. On iOS Safari / installed standalone PWAs,
    //     Apple's ITP purges script-writable cookies (7-day cap / no-interaction
    //     eviction), so the client-side session can silently disappear.
    //   • The durable defense is the SERVER re-setting those cookies on each app
    //     open — that happens in lib/supabase/proxy.ts (updateSession), which
    //     runs on '/protected/*' but is short-circuited for '/' (the public
    //     landing makes zero auth calls). Opening on '/protected' silently
    //     refreshes and re-sets the session before content shows.
    //   • Unauthenticated opens are safe: the proxy redirects to '/auth/login'
    //     (live) or '/' (prelaunch) — never a 500. See
    //     docs/pwa-session-persistence.md.
    start_url: '/protected',
    display: 'standalone',
    background_color: '#EDE6D5',
    theme_color: '#36563D',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
