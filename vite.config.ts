import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import packageJson from './package.json' with { type: 'json' }

// https://vite.dev/config/
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['brand/favicon.ico', 'brand/ionity-global.png', 'brand/ionity-banner.png'],
      manifest: {
        name: 'Ionity NoMore',
        short_name: 'NoMore',
        description: 'Private mobile cleanup and peer-to-peer family safety circle.',
        theme_color: '#092d36',
        background_color: '#f4f8f7',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: '/brand/ionity-global.png',
            sizes: '1000x1000',
            type: 'image/png',
            purpose: 'any',
          },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        navigateFallback: '/index.html',
        // The offline OCR runtime and language model are intentionally
        // precached so AEDi can read message photos with no connection.
        maximumFileSizeToCacheInBytes: 16 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2,webmanifest,gz}'],
      },
    }),
  ],
})
