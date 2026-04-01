import { useCallback, useEffect, useState } from 'react'
import { loadMenus, type ErpMenuCollection } from '@/services/erp/menus'

interface MenuState {
  menus: ErpMenuCollection | null
  loading: boolean
  error: string | null
  reload: () => Promise<void>
}

export function useErpMenus(enabled: boolean): MenuState {
  const [menus, setMenus] = useState<ErpMenuCollection | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!enabled) {
      return
    }
    setLoading(true)
    setError(null)
    try {
      const nextMenus = await loadMenus()
      setMenus(nextMenus)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load ERP menus.')
    } finally {
      setLoading(false)
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled) {
      return
    }
    void reload()
  }, [enabled, reload])

  return { menus, loading, error, reload }
}
