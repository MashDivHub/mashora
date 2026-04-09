/**
 * Preloads critical engine modules after the initial page render.
 * Called once on app startup to warm the module cache.
 */
export function preloadEngineModules(): void {
  // Delay preloading to not compete with initial render
  if (typeof window === 'undefined') return

  requestIdleCallback?.(() => {
    // Preload form and list views (most commonly used)
    import('./views/form/FormView')
    import('./views/list/ListView')
    import('./fields/FieldRegistry')
    import('./ActionService')
  }) ?? setTimeout(() => {
    import('./views/form/FormView')
    import('./views/list/ListView')
    import('./fields/FieldRegistry')
    import('./ActionService')
  }, 2000)
}
