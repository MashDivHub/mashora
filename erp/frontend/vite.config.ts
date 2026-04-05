import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React + routing
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // Data fetching
          'vendor-query': ['@tanstack/react-query'],
          // State management
          'vendor-state': ['zustand'],
          // Charts (large, lazy-loaded)
          'vendor-charts': ['recharts'],
          // Calendar (large, lazy-loaded)
          'vendor-calendar': ['@fullcalendar/react', '@fullcalendar/daygrid', '@fullcalendar/timegrid', '@fullcalendar/interaction', '@fullcalendar/core'],
          // View engine core
          'engine-core': [
            './src/engine/ActionService.ts',
            './src/engine/ActionRouter.tsx',
            './src/engine/ViewRegistry.ts',
            './src/engine/ActionResultHandler.ts',
          ],
          // Field components
          'engine-fields': [
            './src/engine/fields/FieldRegistry.ts',
            './src/engine/fields/CharField.tsx',
            './src/engine/fields/SelectionField.tsx',
            './src/engine/fields/Many2OneField.tsx',
          ],
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8002',
        changeOrigin: true,
        ws: true,
      },
    },
  },
})
