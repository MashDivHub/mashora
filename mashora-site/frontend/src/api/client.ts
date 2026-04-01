import axios, { type InternalAxiosRequestConfig } from 'axios'
import { clearTokens, getAccessToken, getRefreshToken, isTokenExpired, storeTokens } from '@/lib/auth-storage'

const client = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
})

type RetryableRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean
}

let refreshPromise: Promise<string | null> | null = null

async function requestTokenRefresh(): Promise<string | null> {
  const refreshToken = getRefreshToken()
  if (!refreshToken) {
    return null
  }

  if (!refreshPromise) {
    refreshPromise = axios
      .post('/api/v1/auth/refresh', null, {
        params: { refresh_token: refreshToken },
      })
      .then((response) => {
        const { access_token, refresh_token } = response.data as {
          access_token: string
          refresh_token: string
        }
        storeTokens(access_token, refresh_token)
        return access_token
      })
      .catch((error) => {
        clearTokens()
        throw error
      })
      .finally(() => {
        refreshPromise = null
      })
  }

  return refreshPromise
}

// Request interceptor: attach JWT from localStorage
client.interceptors.request.use(async (config) => {
  const url = String(config.url ?? '')
  const isAuthRequest =
    url.includes('/auth/token') ||
    url.includes('/auth/login') ||
    url.includes('/auth/register') ||
    url.includes('/auth/refresh')
  const accessToken = getAccessToken()
  const refreshToken = getRefreshToken()

  if (!isAuthRequest && refreshToken && (!accessToken || isTokenExpired(accessToken, 60))) {
    try {
      await requestTokenRefresh()
    } catch {
      clearTokens()
    }
  }

  const token = getAccessToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Response interceptor: refresh once on 401, then redirect to /login.
client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error.response?.status
    const originalRequest = (error.config ?? {}) as RetryableRequestConfig
    const url = String(originalRequest.url ?? '')
    const isAuthRequest =
      url.includes('/auth/token') ||
      url.includes('/auth/login') ||
      url.includes('/auth/register') ||
      url.includes('/auth/refresh')

    if (status === 401 && !isAuthRequest && !originalRequest._retry) {
      originalRequest._retry = true
      try {
        const nextAccessToken = await requestTokenRefresh()
        if (nextAccessToken) {
          originalRequest.headers.Authorization = `Bearer ${nextAccessToken}`
          return client(originalRequest)
        }
      } catch {
        // Fall through to logout behavior below.
      }
    }

    if (status === 401 && !isAuthRequest) {
      clearTokens()
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export default client
