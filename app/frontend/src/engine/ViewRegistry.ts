import { lazy, type ComponentType } from 'react'

export interface ViewProps {
  model: string
  action?: Record<string, unknown>
  viewDef?: Record<string, unknown>
  domain?: Array<string | [string, string, unknown]>
  context?: Record<string, unknown>
  recordId?: number | null
}

type ViewComponent = ComponentType<ViewProps>

const registry: Record<string, () => Promise<{ default: ViewComponent }>> = {
  form: () => import('./views/form/FormView'),
  list: () => import('./views/list/ListView'),
  tree: () => import('./views/list/ListView'),
  kanban: () => import('./views/kanban/KanbanView'),
  calendar: () => import('./views/calendar/CalendarView'),
  graph: () => import('./views/graph/GraphView'),
  pivot: () => import('./views/pivot/PivotView'),
}

const loadedComponents: Record<string, ViewComponent> = {}

export async function getViewComponent(viewType: string): Promise<ViewComponent | null> {
  if (loadedComponents[viewType]) return loadedComponents[viewType]
  const loader = registry[viewType]
  if (!loader) return null
  const mod = await loader()
  loadedComponents[viewType] = mod.default
  return mod.default
}

export function registerViewType(viewType: string, loader: () => Promise<{ default: ViewComponent }>): void {
  registry[viewType] = loader
}

export function isViewTypeSupported(viewType: string): boolean {
  return viewType in registry
}

export const LazyFormView = lazy(() => import('./views/form/FormView'))
export const LazyListView = lazy(() => import('./views/list/ListView'))
export const LazyKanbanView = lazy(() => import('./views/kanban/KanbanView'))
export const LazyCalendarView = lazy(() => import('./views/calendar/CalendarView'))
export const LazyGraphView = lazy(() => import('./views/graph/GraphView'))
export const LazyPivotView = lazy(() => import('./views/pivot/PivotView'))
