import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
 
export default defineConfig({
  base: '/helvetia-doors/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Helvetia Doors',
        short_name: 'Helvetia Doors',
        description: 'Door installation tracking (Supabase-connected).',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        start_url: '/helvetia-doors/',
        icons: [
          { src: '/helvetia-doors/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/helvetia-doors/pwa-512.png', sizes: '512x512', type: 'image/png' }
        ]
      }
    })
  ]
})
