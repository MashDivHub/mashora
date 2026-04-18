import { erpClient } from '@/lib/erp-api'

export type Domain = unknown[]

export interface ActionResult {
  type?: string
  name?: string
  res_model?: string
  res_id?: number | false
  view_mode?: string
  target?: string
  domain?: Domain
  context?: Record<string, unknown>
  url?: string
  report_name?: string
  report_type?: string
  data?: unknown
  result?: unknown
  action_type?: string
  [key: string]: unknown
}

export type ActionResultCallback = {
  onRefresh: () => void
  onNavigate: (path: string) => void
  onOpenWizard: (model: string, context?: Record<string, unknown>) => void
  onOpenReport: (reportName: string, recordIds: number[]) => void
  onOpenUrl: (url: string) => void
}

function isObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object'
}

export function handleActionResult(
  result: unknown,
  callbacks: ActionResultCallback,
): void {
  // None / True / False → refresh current view
  if (result === null || result === undefined || result === true || result === false) {
    callbacks.onRefresh()
    return
  }

  // Not an object → refresh
  if (!isObject(result)) {
    callbacks.onRefresh()
    return
  }

  const r = result as ActionResult
  // Handle by action type
  const actionType = r.type || r.action_type

  switch (actionType) {
    case 'ir.actions.act_window': {
      if (r.target === 'new') {
        // Open wizard dialog
        callbacks.onOpenWizard(String(r.res_model ?? ''), r.context)
      } else {
        // Navigate to the action
        if (r.res_id) {
          callbacks.onNavigate(`/admin/model/${r.res_model}/${r.res_id}`)
        } else {
          callbacks.onNavigate(`/admin/model/${r.res_model}`)
        }
      }
      break
    }

    case 'ir.actions.act_url': {
      const url = r.url || ''
      if (url) callbacks.onOpenUrl(url)
      break
    }

    case 'ir.actions.report': {
      // Generate and download report
      const reportName = r.report_name || r.name
      const ctx = r.context || {}
      const activeIds = Array.isArray(ctx.active_ids) ? ctx.active_ids as number[] : null
      const activeId = typeof ctx.active_id === 'number' ? ctx.active_id : null
      const recordIds: number[] = activeIds || (activeId != null ? [activeId] : [])
      if (reportName) callbacks.onOpenReport(String(reportName), recordIds)
      break
    }

    case 'ir.actions.client': {
      // Client action — try to look up in registry, otherwise refresh
      callbacks.onRefresh()
      break
    }

    case 'ir.actions.server': {
      // Server action already executed, refresh
      callbacks.onRefresh()
      break
    }

    default: {
      // Unknown or wrapped result — try to extract
      if (isObject(r.result)) {
        handleActionResult(r.result, callbacks)
      } else {
        callbacks.onRefresh()
      }
    }
  }
}

export async function generateReport(
  reportName: string,
  recordIds: number[],
): Promise<{ content: string; contentType: string; filename: string }> {
  const { data } = await erpClient.raw.post('/reports/generate', {
    report_name: reportName,
    record_ids: recordIds,
    output_format: 'pdf',
  })
  return {
    content: data.content,
    contentType: data.content_type || 'application/pdf',
    filename: data.filename || `${reportName}.pdf`,
  }
}

export function downloadBase64(content: string, filename: string, contentType: string = 'application/pdf'): void {
  const byteChars = atob(content)
  const byteNumbers = new Array(byteChars.length)
  for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i)
  const byteArray = new Uint8Array(byteNumbers)
  const blob = new Blob([byteArray], { type: contentType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
