import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// Matches the "https" profile in Properties/launchSettings.json.
// Override with: VITE_SERVER_URL=http://localhost:5006 npm run dev
const serverUrl = process.env.VITE_SERVER_URL ?? 'https://localhost:7048'

const proxyTarget = {
  target: serverUrl,
  changeOrigin: true,
  secure: false, // the ASP.NET dev certificate is self-signed
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons.svg', 'sounds/*'],
      manifest: {
        name: 'Catan Online',
        short_name: 'Catan',
        description: 'Play Settlers of Catan online with friends and bots.',
        theme_color: '#1c1917',
        background_color: '#1c1917',
        display: 'standalone',
        orientation: 'landscape',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2,mp3,ogg,wav}'],
        // Never let the service worker intercept the live game connection.
        navigateFallbackDenylist: [/^\/hubs\//, /^\/api\//],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'google-fonts', expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      // Forwards API calls to the ASP.NET Core host so the browser sees a single origin.
      '/api': proxyTarget,
      // SignalR negotiates over HTTP then upgrades to WebSockets, so ws must be enabled.
      '/hubs': { ...proxyTarget, ws: true },
    },
  },
})
