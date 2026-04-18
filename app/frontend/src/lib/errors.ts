/**
 * Shared error-extraction helper. Narrows `unknown` — the default for `catch`
 * under `useUnknownInCatchVariables` / strict mode — into a user-facing message
 * by probing axios-shaped response errors and falling back to `Error.message`.
 *
 * Hoisted from duplicate copies in `pages/website/ProductEditor.tsx`,
 * `pages/sales/SalesOrderDetail.tsx`, and `components/shared/OrderLinesEditor.tsx`
 * so additional `: any → : unknown` conversions across detail pages can share
 * a single implementation.
 */
export function extractErrorMessage(e: unknown, fallback = 'Unknown error'): string {
  if (e && typeof e === 'object') {
    const err = e as { response?: { data?: { detail?: unknown } }; message?: unknown }
    const detail = err.response?.data?.detail
    if (typeof detail === 'string') return detail
    if (typeof err.message === 'string') return err.message
  }
  if (e instanceof Error) return e.message
  return fallback
}
