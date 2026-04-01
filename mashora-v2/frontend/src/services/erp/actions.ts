import type { SupportedViewMode } from '@/lib/erp-view'
import { rpc } from '@/services/erp/client'

export interface ErpAction {
  id: number | string
  name: string
  type: string
  target?: string
  help?: string
  res_model?: string
  context?: Record<string, unknown> | string
  domain?: unknown[] | string
  limit?: number
  views: Array<[number | false, string]>
}

export async function loadAction(actionId: number, context: Record<string, unknown> = {}) {
  return rpc<ErpAction>('/web/action/load', {
    action_id: actionId,
    context,
  })
}

export function normalizeViewType(viewType: string): SupportedViewMode | null {
  if (viewType === 'tree' || viewType === 'list') {
    return 'list'
  }
  if (viewType === 'kanban') {
    return 'kanban'
  }
  if (viewType === 'form') {
    return 'form'
  }
  return null
}

export function getSupportedViewModes(action: ErpAction) {
  const modes = action.views
    .map(([, viewType]) => normalizeViewType(viewType))
    .filter((viewType): viewType is SupportedViewMode => Boolean(viewType))

  return Array.from(new Set(modes))
}

export function getPrimaryViewMode(action: ErpAction): SupportedViewMode {
  return getSupportedViewModes(action)[0] || 'list'
}
