import { erpClient } from '@/lib/erp-api'

export interface ActionResult {
  type?: string
  name?: string
  res_model?: string
  res_id?: number | false
  view_mode?: string
  target?: string
  domain?: any[]
  context?: Record<string, any>
  url?: string
  report_name?: string
  report_type?: string
  data?: any
  [key: string]: any
}

export type ActionResultCallback = {
  onRefresh: () => void
  onNavigate: (path: string) => void
  onOpenWizard: (model: string, context?: Record<string, any>) => void
  onOpenReport: (reportName: string, recordIds: number[]) => void
  onOpenUrl: (url: string) => void
}

export function handleActionResult(
  result: any,
  callbacks: ActionResultCallback,
): void {
  // None / True / False → refresh current view
  if (result === null || result === undefined || result === true || result === false) {
    callbacks.onRefresh()
    return
  }

  // Not an object → refresh
  if (typeof result !== 'object') {
    callbacks.onRefresh()
    return
  }

  // Handle by action type
  const actionType = result.type || result.action_type

  switch (actionType) {
    case 'ir.actions.act_window': {
      if (result.target === 'new') {
        // Open wizard dialog
        callbacks.onOpenWizard(result.res_model, result.context)
      } else {
        // Navigate to the action
        if (result.res_id) {
          callbacks.onNavigate(`/admin/model/${result.res_model}/${result.res_id}`)
        } else {
          callbacks.onNavigate(`/admin/model/${result.res_model}`)
        }
      }
      break
    }

    case 'ir.actions.act_url': {
      const url = result.url || ''
      if (url) callbacks.onOpenUrl(url)
      break
    }

    case 'ir.actions.report': {
      // Generate and download report
      const reportName = result.report_name || result.name
      const recordIds = result.context?.active_ids || (result.context?.active_id ? [result.context.active_id] : [])
      if (reportName) callbacks.onOpenReport(reportName, recordIds)
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
      if (result.result && typeof result.result === 'object') {
        handleActionResult(result.result, callbacks)
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
