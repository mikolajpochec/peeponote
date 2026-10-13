import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig, type Plugin } from 'vite'
import { APP_VERSION, CHANGELOG } from './src/version.ts'

/**
 * version.json next to index.html: the version this build is and its changelog. A running (older) app reads it
 * when the service worker finds an update, so it can say what the update brings before switching to it.
 */
const versionManifest = (): Plugin => ({
  name: 'peeponote-version-json',
  apply: 'build',
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ version: APP_VERSION, changelog: CHANGELOG }) })
  },
})

export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    versionManifest(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['peepo/*.webp', 'favicon.webp'],
      manifest: {
        name: 'peeponote',
        short_name: 'peeponote',
        description: 'Git-backed visual boards. Save = commit. Yeet = push. peepoHappy',
        theme_color: '#0f1113',
        background_color: '#0f1113',
        display: 'standalone',
        start_url: './',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,webp,png,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
      },
    }),
  ],
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1500,
  },
})
