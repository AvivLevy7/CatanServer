import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

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
  plugins: [react(), tailwindcss()],
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
