import { ThemeProvider } from 'next-themes'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { LoginPage } from '@/pages/login-page'
import { WorkspacePage } from '@/pages/workspace-page'
import { useErpSession } from '@/hooks/use-erp-session'

function BootSplash() {
  return <div className="min-h-screen bg-background" />
}

function PublicLoginRoute() {
  const { status } = useErpSession()

  if (status === 'loading' || status === 'idle') {
    return <BootSplash />
  }

  if (status === 'authenticated') {
    return <Navigate to="/app" replace />
  }

  return <LoginPage />
}

function ProtectedWorkspaceRoute() {
  const { status } = useErpSession()

  if (status === 'authenticated') {
    return <WorkspacePage />
  }

  if (status === 'anonymous') {
    return <Navigate to="/login" replace />
  }

  return <BootSplash />
}

export function App() {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      storageKey="mashora-erp-theme"
      disableTransitionOnChange
    >
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<PublicLoginRoute />} />
          <Route path="/app" element={<ProtectedWorkspaceRoute />} />
          <Route path="/app/:menuId" element={<ProtectedWorkspaceRoute />} />
          <Route path="*" element={<Navigate to="/app" replace />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  )
}
