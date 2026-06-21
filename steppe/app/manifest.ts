import type { MetadataRoute } from 'next'

// If you already have a manifest, merge the `icons` array (and theme/background
// colors) into it rather than adding a second manifest.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Steppe',
    short_name: 'Steppe',
    description: 'A high desert civic commons for Redmond, Central Oregon.',
    start_url: '/',
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
