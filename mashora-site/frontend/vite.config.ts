import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'

const proxyTargets = {
  api: 'http://localhost:8000',
  legacy: 'http://localhost:8070',
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 8069,
    strictPort: true,
    proxy: {
      '/api': {
        target: proxyTargets.api,
        changeOrigin: true,
      },
      '/web': {
        target: proxyTargets.legacy,
        changeOrigin: true,
        ws: true,
      },
      '/mashora': {
        target: proxyTargets.legacy,
        changeOrigin: true,
        ws: true,
      },
      '/websocket': {
        target: proxyTargets.legacy,
        changeOrigin: true,
        ws: true,
      },
      '/mail': {
        target: proxyTargets.legacy,
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 8069,
    strictPort: true,
    proxy: {
      '/api': {
        target: proxyTargets.api,
        changeOrigin: true,
      },
      '/web': {
        target: proxyTargets.legacy,
        changeOrigin: true,
      },
      '/mashora': {
        target: proxyTargets.legacy,
        changeOrigin: true,
      },
      '/websocket': {
        target: proxyTargets.legacy,
        changeOrigin: true,
        ws: true,
      },
      '/mail': {
        target: proxyTargets.legacy,
        changeOrigin: true,
      },
    },
  },
})
