import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'

const erpTarget = process.env.VITE_ERP_PROXY_TARGET || 'http://localhost:8069'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 3001,
    strictPort: true,
    proxy: {
      '/web': {
        target: erpTarget,
        changeOrigin: true,
        ws: true,
      },
      '/mashora': {
        target: erpTarget,
        changeOrigin: true,
        ws: true,
      },
      '/websocket': {
        target: erpTarget,
        changeOrigin: true,
        ws: true,
      },
      '/mail': {
        target: erpTarget,
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 3001,
    strictPort: true,
  },
})
