import { useState, useCallback } from 'react'

export function useBulkSelect() {
  const [selected, setSelected] = useState<number[]>([])

  const toggle = useCallback((id: number) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }, [])

  const toggleAll = useCallback((ids: number[]) => {
    setSelected(prev => prev.length === ids.length ? [] : ids)
  }, [])

  const clear = useCallback(() => setSelected([]), [])

  const isSelected = useCallback((id: number) => selected.includes(id), [selected])

  return { selected, toggle, toggleAll, clear, isSelected, setSelected }
}
