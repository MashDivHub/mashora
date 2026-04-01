import { useEffect } from 'react'
import { useAuthStore } from '@/store/auth-store'

export function useErpSession() {
  const status = useAuthStore((state) => state.status)
  const session = useAuthStore((state) => state.session)
  const error = useAuthStore((state) => state.error)
  const bootstrap = useAuthStore((state) => state.bootstrap)
  const login = useAuthStore((state) => state.login)
  const logout = useAuthStore((state) => state.logout)
  const clearError = useAuthStore((state) => state.clearError)

  useEffect(() => {
    if (status === 'idle') {
      void bootstrap()
    }
  }, [bootstrap, status])

  return {
    status,
    session,
    error,
    login,
    logout,
    clearError,
  }
}
