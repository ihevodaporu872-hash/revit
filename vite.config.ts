import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

const backendTarget = process.env.VITE_BACKEND_TARGET || 'http://127.0.0.1:3101'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: backendTarget,
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes) => {
            if (proxyRes.headers['content-type']?.includes('text/event-stream')) {
              proxyRes.headers['cache-control'] = 'no-cache'
              proxyRes.headers['connection'] = 'keep-alive'
            }
          })
        },
      },
      '/uploads': {
        target: backendTarget,
        changeOrigin: true,
      },
    },
  },
  assetsInclude: ['**/*.wasm'],
  optimizeDeps: {
    exclude: ['web-ifc', '@mlightcad/cad-simple-viewer'],
  },
})
