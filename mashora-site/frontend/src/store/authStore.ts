import { create } from 'zustand'
import { login as apiLogin, getMe, User } from '../api/auth'
import { clearTokens, getAccessToken, getRefreshToken, storeTokens } from '@/lib/auth-storage'

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  setUser: (user: User) => void
  initFromStorage: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: getAccessToken(),
  isAuthenticated: Boolean(getAccessToken() || getRefreshToken()),

  login: async (email: string, password: string) => {
    const data = await apiLogin(email, password)
    storeTokens(data.access_token, data.refresh_token)
    const user = await getMe()
    set({ token: getAccessToken(), user, isAuthenticated: true })
  },

  logout: () => {
    clearTokens()
    set({ token: null, user: null, isAuthenticated: false })
  },

  setUser: (user: User) => {
    set({ user })
  },

  initFromStorage: async () => {
    const hasStoredSession = Boolean(getAccessToken() || getRefreshToken())
    if (hasStoredSession) {
      try {
        const user = await getMe()
        set({ token: getAccessToken(), user, isAuthenticated: true })
      } catch {
        clearTokens()
        set({ token: null, user: null, isAuthenticated: false })
      }
    }
  },
}))
