import { create } from 'zustand'
import { erpClient, authStorage } from '@/lib/erp-api'

interface User {
  id: number
  name: string
  login: string
  email: string
  lang: string
  tz: string
  company_id: number
  company_name: string
  company_ids: number[]
  image_128?: string
}

interface AuthState {
  user: User | null
  loading: boolean
  error: string | null
  isAuthenticated: boolean

  login: (login: string, password: string) => Promise<boolean>
  logout: () => void
  fetchUser: () => Promise<void>
  clearError: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: false,
  error: null,
  isAuthenticated: (() => {
    const token = authStorage.getAccessToken()
    return !!token && !authStorage.isTokenExpired(token)
  })(),

  login: async (login: string, password: string): Promise<boolean> => {
    set({ loading: true, error: null })
    try {
      const { data } = await erpClient.raw.post('/auth/login', { login, password })
      authStorage.storeTokens(data.access_token, data.refresh_token)
      set({ user: data.user, isAuthenticated: true, loading: false, error: null })
      return true
    } catch (err: unknown) {
      let message = 'Invalid credentials'
      if (typeof err === 'object' && err !== null && 'response' in err) {
        const resp = (err as { response?: { data?: { detail?: string; message?: string } } }).response
        message = resp?.data?.detail || resp?.data?.message || message
      }
      set({ loading: false, error: message })
      return false
    }
  },

  logout: () => {
    authStorage.clearTokens()
    set({ user: null, isAuthenticated: false, error: null })
    window.location.href = '/login'
  },

  fetchUser: async () => {
    const token = authStorage.getAccessToken()
    if (!token || authStorage.isTokenExpired(token)) {
      set({ isAuthenticated: false })
      return
    }
    set({ loading: true })
    try {
      const { data } = await erpClient.raw.get('/auth/me')
      set({ user: data, isAuthenticated: true, loading: false })
    } catch {
      set({ loading: false, isAuthenticated: false })
    }
  },

  clearError: () => set({ error: null }),
}))
