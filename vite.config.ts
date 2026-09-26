import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        // Ne jamais précacher/servir la page HTML depuis le cache : elle doit
        // toujours être récupérée fraîche pour référencer les derniers bundles
        // JS après un déploiement (sinon l'app peut rester bloquée sur une
        // ancienne version tant que l'onglet n'est pas rechargé manuellement).
        globPatterns: ['**/*.{js,css,ico,png,svg}'],
        navigateFallback: null,
      },
      manifest: {
        name: 'CRM Pro',
        short_name: 'CRM Pro',
        description: 'CRM & facturation pour indépendants et petites entreprises',
        theme_color: '#1e40af',
        background_color: '#f8fafc',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      }
    })
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') }
  },
  server: {
    // Exclure les dossiers d'outils externes du watcher pour éviter EBUSY
    watch: {
      ignored: [
        '**/.claude/**',
        '**/node_modules/**',
        '**/.git/**',
      ]
    }
  }
})
