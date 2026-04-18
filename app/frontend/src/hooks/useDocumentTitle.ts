import { useEffect } from 'react'

/**
 * Sets `document.title` to `${title} — Mashora ERP` while the component is mounted.
 * Restores the previous title on unmount.
 *
 * Pass an empty string (or no meaningful title) and the tab title falls back to the bare
 * app name — useful for shell routes that render their own nested titles.
 */
export function useDocumentTitle(title: string): void {
  useEffect(() => {
    const prev = document.title
    document.title = title ? `${title} — Mashora ERP` : 'Mashora ERP'
    return () => {
      document.title = prev
    }
  }, [title])
}
