/**
 * Base API client with JWT interceptors.
 * Extracted from portal/frontend/src/api/client.ts and generalized.
 */
import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from 'axios'
import { type AuthStorage, createAuthStorage } from './auth-storage'

export interface ApiClientConfig {
  baseURL: string
  authStorage?: AuthStorage
  refreshUrl?: string
  onUnauthorized?: () => void
}

type RetryableConfig = InternalAxiosRequestConfig & { _retry?: boolean }

export function createApiClient(config: ApiClientConfig): AxiosInstance {
  const {
    baseURL,
    authStorage = createAuthStorage(),
    refreshUrl = '/auth/refresh',
    onUnauthorized,
  } = config

  const client = axios.create({
    baseURL,
    headers: { 'Content-Type': 'application/json' },
  })

  let refreshPromise: Promise<string | null> | null = null

  async function requestTokenRefresh(): Promise<string | null> {
    const refreshToken = authStorage.getRefreshToken()
    if (!refreshToken) return null

    if (!refreshPromise) {
      refreshPromise = axios
        .post(`${baseURL}${refreshUrl}`, { refresh_token: refreshToken })
        .then((response) => {
          const { access_token, refresh_token } = response.data as {
            access_token: string
            refresh_token: string
          }
          authStorage.storeTokens(access_token, refresh_token)
          return access_token
        })
        .catch(() => {
          authStorage.clearTokens()
          return null
        })
        .finally(() => {
          refreshPromise = null
        })
    }

    return refreshPromise
  }

  // Request interceptor: attach JWT, pre-refresh if expiring
  client.interceptors.request.use(async (cfg) => {
    const url = String(cfg.url ?? '')
    const isAuthRequest = url.includes('/auth/')

    if (!isAuthRequest) {
      const accessToken = authStorage.getAccessToken()
      const refreshToken = authStorage.getRefreshToken()

      if (refreshToken && (!accessToken || authStorage.isTokenExpired(accessToken, 60))) {
        await requestTokenRefresh()
      }
    }

    const token = authStorage.getAccessToken()
    if (token) {
      cfg.headers.Authorization = `Bearer ${token}`
    }
    return cfg
  })

  // Response interceptor: retry once on 401
  client.interceptors.response.use(
    (response) => response,
    async (error) => {
      const status = error.response?.status
      const originalRequest = (error.config ?? {}) as RetryableConfig
      const url = String(originalRequest.url ?? '')
      const isAuthRequest = url.includes('/auth/')

      if (status === 401 && !isAuthRequest && !originalRequest._retry) {
        originalRequest._retry = true
        const newToken = await requestTokenRefresh()
        if (newToken) {
          originalRequest.headers.Authorization = `Bearer ${newToken}`
          return client(originalRequest)
        }
      }

      if (status === 401 && !isAuthRequest) {
        authStorage.clearTokens()
        onUnauthorized?.()
      }

      return Promise.reject(error)
    }
  )

  return client
}
