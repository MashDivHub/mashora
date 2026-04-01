export const ACCESS_TOKEN_KEY = 'token'
export const REFRESH_TOKEN_KEY = 'refresh_token'

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY)
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY)
}

export function storeTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken)
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
}

export function isTokenExpired(token: string, skewSeconds = 0): boolean {
  try {
    const [, payload] = token.split('.')
    if (!payload) {
      return true
    }

    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=')
    const decoded = JSON.parse(atob(padded)) as { exp?: number }

    if (!decoded.exp) {
      return true
    }

    return decoded.exp <= Math.floor(Date.now() / 1000) + skewSeconds
  } catch {
    return true
  }
}
