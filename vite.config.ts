import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

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
        target: 'http://localhost:3001',
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
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  assetsInclude: ['**/*.wasm'],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          pdfjs: ['pdfjs-dist'],
          xlsx: ['xlsx'],
          univerjs: [
            '@univerjs/core',
            '@univerjs/design',
            '@univerjs/engine-formula',
            '@univerjs/engine-render',
            '@univerjs/presets',
            '@univerjs/sheets',
            '@univerjs/sheets-ui',
            '@univerjs/ui',
          ],
        },
      },
    },
  },
  optimizeDeps: {
    exclude: ['web-ifc'],
    include: ['rxjs', '@wendellhu/redi', 'dayjs'],
  },
})
