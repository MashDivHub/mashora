import { create } from 'zustand'
import { login as apiLogin, getMe, User } from '../api/auth'

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
  token: localStorage.getItem('token'),
  isAuthenticated: !!localStorage.getItem('token'),

  login: async (email: string, password: string) => {
    const data = await apiLogin(email, password)
    localStorage.setItem('token', data.access_token)
    const user = await getMe()
    set({ token: data.access_token, user, isAuthenticated: true })
  },

  logout: () => {
    localStorage.removeItem('token')
    set({ token: null, user: null, isAuthenticated: false })
  },

  setUser: (user: User) => {
    set({ user })
  },

  initFromStorage: async () => {
    const token = localStorage.getItem('token')
    if (token) {
      try {
        const user = await getMe()
        set({ token, user, isAuthenticated: true })
      } catch {
        localStorage.removeItem('token')
        set({ token: null, user: null, isAuthenticated: false })
      }
    }
  },
}))
