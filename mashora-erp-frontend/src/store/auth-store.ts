import { create } from 'zustand'
import {
  authenticate,
  destroySession,
  getSessionInfo,
  type LoginPayload,
  type SessionInfo,
} from '@/services/erp/auth'

const DEFAULT_DATABASE = import.meta.env.VITE_ERP_DATABASE || ''

type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'anonymous'

interface AuthState {
  status: AuthStatus
  session: SessionInfo | null
  error: string | null
  bootstrap: () => Promise<SessionInfo | null>
  login: (payload: LoginPayload) => Promise<boolean>
  logout: () => Promise<void>
  clearError: () => void
}

function persistDatabase(db: string) {
  if (typeof window !== 'undefined' && db) {
    window.localStorage.setItem('mashora-erp-db', db)
  }
}

export function getPreferredDatabase() {
  if (typeof window === 'undefined') {
    return DEFAULT_DATABASE
  }
  return window.localStorage.getItem('mashora-erp-db') || DEFAULT_DATABASE
}

export const useAuthStore = create<AuthState>((set) => ({
  status: 'idle',
  session: null,
  error: null,
  async bootstrap() {
    set({ status: 'loading', error: null })
    try {
      const session = await getSessionInfo()
      if (session?.uid) {
        persistDatabase(session.db || '')
        set({ status: 'authenticated', session, error: null })
        return session
      }
      set({ status: 'anonymous', session: null, error: null })
      return null
    } catch {
      set({ status: 'anonymous', session: null, error: null })
      return null
    }
  },
  async login(payload) {
    set({ status: 'loading', error: null })
    try {
      await authenticate(payload)
      const session = await getSessionInfo()
      if (!session?.uid) {
        throw new Error('Authentication succeeded but no active session was returned.')
      }
      persistDatabase(payload.db)
      set({ status: 'authenticated', session, error: null })
      return true
    } catch (error) {
      set({
        status: 'anonymous',
        session: null,
        error: error instanceof Error ? error.message : 'Unable to log in.',
      })
      return false
    }
  },
  async logout() {
    try {
      await destroySession()
    } finally {
      set({ status: 'anonymous', session: null, error: null })
    }
  },
  clearError() {
    set({ error: null })
  },
}))
