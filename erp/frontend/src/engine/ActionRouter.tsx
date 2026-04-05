import { useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Suspense, lazy, useState } from 'react'
import { fetchAction, fetchActionForModel } from './ActionService'
import { LazyFormView, LazyListView, LazyKanbanView, LazyCalendarView, LazyGraphView, LazyPivotView } from './ViewRegistry'
import type { ViewProps } from './ViewRegistry'
import { Skeleton } from '@mashora/design-system'
import { getClientAction } from './ClientActionRegistry'

function ViewFallback() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-64 rounded-2xl" />
      <Skeleton className="h-[400px] w-full rounded-3xl" />
    </div>
  )
}

/**
 * Parse an action reference like "ir.actions.client,125" or just "125"
 * Returns { actionId, actionModel }
 */
function parseActionRef(ref: string): { actionId: number | string; actionModel?: string } {
  if (ref.includes(',')) {
    const lastComma = ref.lastIndexOf(',')
    const model = ref.substring(0, lastComma)
    const id = ref.substring(lastComma + 1)
    return { actionId: parseInt(id), actionModel: model }
  }
  return { actionId: /^\d+$/.test(ref) ? parseInt(ref) : ref }
}

export default function ActionRouter() {
  const { actionId: rawActionId, model, id } = useParams<{ actionId?: string; model?: string; id?: string }>()
  const [searchParams] = useSearchParams()
  const [currentViewType, setCurrentViewType] = useState<string | null>(null)

  // Parse the action reference
  const parsed = rawActionId ? parseActionRef(rawActionId) : null

  // Resolve action — either by ID or by model
  const { data: action, isLoading } = useQuery({
    queryKey: ['action', rawActionId, model],
    queryFn: async () => {
      if (parsed) return fetchAction(parsed.actionId, parsed.actionModel)
      if (model) return fetchActionForModel(model)
      return null
    },
    staleTime: 5 * 60 * 1000,
  })

  if (isLoading) return <ViewFallback />
  if (!action) return <div className="text-muted-foreground p-8">No action found</div>

  // Handle client actions (dashboards, custom pages)
  if (action.action_type === 'ir.actions.client' || action.type === 'ir.actions.client') {
    const tag = action.tag
    const loader = tag ? getClientAction(tag) : null
    if (loader) {
      const LazyClient = lazy(loader)
      return (
        <Suspense fallback={<ViewFallback />}>
          <LazyClient />
        </Suspense>
      )
    }
    return (
      <div className="rounded-3xl border border-border/60 bg-card p-8 text-center text-muted-foreground">
        Client action "{tag || action.name}" is not yet implemented.
      </div>
    )
  }

  // Handle URL actions
  if (action.action_type === 'ir.actions.act_url' || action.type === 'ir.actions.act_url') {
    if (action.url) {
      window.open(action.url, action.target === 'self' ? '_self' : '_blank')
    }
    return <div className="text-muted-foreground p-8">Redirecting...</div>
  }

  // Handle server actions (these usually return another action)
  if (action.action_type === 'ir.actions.server' || action.type === 'ir.actions.server') {
    return (
      <div className="rounded-3xl border border-border/60 bg-card p-8 text-center text-muted-foreground">
        Server action "{action.name}" — execute from a record context.
      </div>
    )
  }

  // Standard window action
  const viewType = currentViewType || (id ? 'form' : action.view_mode_list?.[0] || 'list')
  const recordId = id ? parseInt(id) : null

  const viewProps: ViewProps = {
    model: action.res_model,
    action,
    domain: Array.isArray(action.domain) ? action.domain : [],
    recordId,
  }

  const viewModes = (action.view_mode_list || []).filter((vt: string) => vt !== 'activity' && vt !== 'form')

  return (
    <div className="space-y-4">
      {/* View type switcher — hidden when viewing a specific record or only 1 view mode */}
      {viewModes.length > 1 && !id && (
        <div className="flex gap-1">
          {viewModes.map((vt: string) => (
            <button
              key={vt}
              onClick={() => setCurrentViewType(vt)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                viewType === vt
                  ? 'bg-zinc-900 text-white dark:bg-zinc-800'
                  : 'text-muted-foreground hover:bg-accent'
              }`}
            >
              {vt === 'tree' ? 'List' : vt.charAt(0).toUpperCase() + vt.slice(1)}
            </button>
          ))}
        </div>
      )}

      <Suspense fallback={<ViewFallback />}>
        {viewType === 'form' ? (
          <LazyFormView {...viewProps} recordId={recordId} />
        ) : viewType === 'list' || viewType === 'tree' ? (
          <LazyListView {...viewProps} />
        ) : viewType === 'kanban' ? (
          <LazyKanbanView {...viewProps} />
        ) : viewType === 'calendar' ? (
          <LazyCalendarView {...viewProps} />
        ) : viewType === 'graph' ? (
          <LazyGraphView {...viewProps} />
        ) : viewType === 'pivot' ? (
          <LazyPivotView {...viewProps} />
        ) : (
          <div className="rounded-3xl border border-border/60 bg-card p-8 text-center text-muted-foreground">
            View type "{viewType}" is not yet supported.
          </div>
        )}
      </Suspense>
    </div>
  )
}
