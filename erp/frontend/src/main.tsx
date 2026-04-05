import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from 'next-themes'
import { configureBoneyard } from 'boneyard-js/react'
import App from './App'
import '@mashora/design-system/theme'
import '@mashora/design-system/globals'
import './index.css'

// Configure boneyard skeleton defaults to match our design system
configureBoneyard({
  color: 'hsl(240 4.8% 95.9%)',           // --muted light
  darkColor: 'hsl(240 3.7% 15.9%)',       // --muted dark
  animate: 'shimmer',
})

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </ThemeProvider>
  </React.StrictMode>
)
