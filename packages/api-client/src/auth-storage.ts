/**
 * Token storage abstraction.
 * Uses localStorage by default but can be replaced with any storage backend.
 */

export interface AuthStorage {
  getAccessToken(): string | null
  getRefreshToken(): string | null
  storeTokens(accessToken: string, refreshToken: string): void
  clearTokens(): void
  isTokenExpired(token: string, skewSeconds?: number): boolean
}

export function createAuthStorage(prefix = 'mashora'): AuthStorage {
  const ACCESS_KEY = `${prefix}_access_token`
  const REFRESH_KEY = `${prefix}_refresh_token`

  function parseJwtPayload(token: string): Record<string, any> | null {
    try {
      const base64Url = token.split('.')[1]
      if (!base64Url) return null
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
      return JSON.parse(atob(base64))
    } catch {
      return null
    }
  }

  return {
    getAccessToken() {
      return localStorage.getItem(ACCESS_KEY)
    },

    getRefreshToken() {
      return localStorage.getItem(REFRESH_KEY)
    },

    storeTokens(accessToken: string, refreshToken: string) {
      localStorage.setItem(ACCESS_KEY, accessToken)
      localStorage.setItem(REFRESH_KEY, refreshToken)
    },

    clearTokens() {
      localStorage.removeItem(ACCESS_KEY)
      localStorage.removeItem(REFRESH_KEY)
    },

    isTokenExpired(token: string, skewSeconds = 60): boolean {
      const payload = parseJwtPayload(token)
      if (!payload?.exp) return true
      return Date.now() >= (payload.exp - skewSeconds) * 1000
    },
  }
}
