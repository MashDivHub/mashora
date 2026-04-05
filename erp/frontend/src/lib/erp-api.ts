import { createErpClient } from '@mashora/api-client'
import { createAuthStorage } from '@mashora/api-client'

const authStorage = createAuthStorage('mashora_erp')

export const erpClient = createErpClient({
  baseURL: '/api/v1',
  authStorage,
  onUnauthorized: () => {
    if (window.location.pathname !== '/login') {
      window.location.href = '/login'
    }
  },
})

export { authStorage }
