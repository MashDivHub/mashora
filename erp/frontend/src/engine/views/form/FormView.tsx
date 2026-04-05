import { useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Skeleton } from '@mashora/design-system'
import { Save, X, ChevronLeft, Pencil } from 'lucide-react'
import type { ViewProps } from '../../ViewRegistry'
import { fetchAction } from '../../ActionService'
import { handleActionResult, type ActionResultCallback } from '../../ActionResultHandler'
import { createRecordState, updateField, mergeOnchangeResult, markSaved, type RecordState } from '../../state/RecordState'
import { loadFormData, saveRecord, handleOnchange, executeButton } from './FormController'
import FormRenderer from './FormRenderer'
import WizardDialog from '../../wizard/WizardDialog'
import ReportDialog from '../../ReportDialog'
import PrintMenu from '../../PrintMenu'
import Chatter from '@/components/Chatter'
import { erpClient } from '@/lib/erp-api'
import AttachmentPanel from '../../AttachmentPanel'
import { DebugPanel } from '../../DebugMode'

export default function FormView({ model, recordId }: ViewProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(!recordId)
  const [state, setState] = useState<RecordState | null>(null)
  const [wizardState, setWizardState] = useState<{ open: boolean; model: string; context?: Record<string, any> }>({ open: false, model: '' })
  const [reportState, setReportState] = useState<{ open: boolean; reportName: string; recordIds: number[] }>({ open: false, reportName: '', recordIds: [] })

  const { data: formData, isLoading } = useQuery({
    queryKey: ['form', model, recordId],
    queryFn: () => loadFormData(model, recordId ?? null),
    staleTime: 0,
  })

  const { data: modelInfo } = useQuery({
    queryKey: ['modelInfo', model],
    queryFn: async () => {
      const { data } = await erpClient.raw.get(`/views/${model}/info`)
      return data
    },
    staleTime: 5 * 60 * 1000,
  })
  const hasChatter = modelInfo?.is_mail_thread ?? false

  useEffect(() => {
    if (formData) {
      setState(createRecordState(model, formData.record.id ?? null, formData.record))
    }
  }, [formData, model])

  const actionCallbacks: ActionResultCallback = {
    onRefresh: () => queryClient.invalidateQueries({ queryKey: ['form', model, recordId] }),
    onNavigate: (path) => navigate(path),
    onOpenWizard: (wizModel, ctx) => setWizardState({ open: true, model: wizModel, context: ctx }),
    onOpenReport: (reportName, ids) => setReportState({ open: true, reportName, recordIds: ids.length ? ids : (recordId ? [recordId] : []) }),
    onOpenUrl: (url) => window.open(url, '_blank'),
  }

  const handleFieldChange = useCallback(async (fieldName: string, value: any) => {
    if (!state) return
    const newState = updateField(state, fieldName, value)
    setState(newState)
    try {
      const result = await handleOnchange(model, state.id, fieldName, value, newState.data)
      const updates = result?.updated_fields || result?.value
      if (updates && Object.keys(updates).length > 0) {
        setState(prev => prev ? mergeOnchangeResult(prev, updates) : prev)
      }
    } catch {}
  }, [state, model])

  const handleSave = useCallback(async () => {
    if (!state) return
    try {
      const saved = await saveRecord(model, state)
      const newId = saved.id ?? state.id
      setState(prev => prev ? markSaved(prev, saved) : prev)
      setEditing(false)
      if (!recordId && newId) {
        navigate(`/model/${model}/${newId}`, { replace: true })
      } else {
        queryClient.invalidateQueries({ queryKey: ['form', model, recordId] })
      }
    } catch {}
  }, [state, model, recordId, navigate, queryClient])

  const handleDiscard = useCallback(() => {
    if (!recordId) {
      navigate(-1)
    } else {
      queryClient.invalidateQueries({ queryKey: ['form', model, recordId] })
      setEditing(false)
    }
  }, [recordId, model, navigate, queryClient])

  const handleButton = useCallback(async (method: string, confirmMsg?: string) => {
    if (confirmMsg && !window.confirm(confirmMsg)) return

    if (method.startsWith('__action__')) {
      const actionRef = method.replace('__action__', '')
      const actionId = /^\d+$/.test(actionRef) ? parseInt(actionRef) : actionRef
      if (actionId) {
        try {
          const action = await fetchAction(actionId)
          // Handle report actions directly
          if (action.action_type === 'ir.actions.report' || action.type === 'ir.actions.report') {
            const reportName = (action as any).report_name || actionRef
            const ids = state?.id ? [state.id] : []
            setReportState({ open: true, reportName, recordIds: ids })
          } else {
            handleActionResult(action, actionCallbacks)
          }
        } catch (e: any) {
          console.error('Action failed:', e)
        }
      }
      return
    }

    // If new record (no ID), save first then execute
    let recordId = state?.id
    if (!recordId && state) {
      try {
        const saved = await saveRecord(model, state)
        recordId = saved.id ?? null
        if (recordId) {
          setState(prev => prev ? markSaved(prev, saved) : prev)
          navigate(`/model/${model}/${recordId}`, { replace: true })
        }
      } catch (e: any) {
        console.error('Save before action failed:', e)
        return
      }
    }

    if (!recordId) return
    try {
      const result = await executeButton(model, recordId, method)
      handleActionResult(result, actionCallbacks)
    } catch (e: any) {
      console.error('Button action failed:', e)
    }
  }, [state, model, actionCallbacks, navigate])

  if (isLoading || !formData || !state) {
    return (
      <div className="-mx-4 sm:-mx-6 lg:-mx-8 -mt-6 lg:-mt-10">
        <div className="flex items-center justify-between gap-3 border-b border-border/40 px-6 py-2.5">
          <Skeleton className="h-6 w-16 rounded-lg" />
          <Skeleton className="h-8 w-24 rounded-xl" />
        </div>
        <div className="px-6 py-5 space-y-5">
          <div className="flex gap-2">
            <Skeleton className="h-9 w-20 rounded-xl" />
            <Skeleton className="h-9 w-20 rounded-xl" />
            <Skeleton className="h-9 w-20 rounded-xl" />
            <div className="ml-auto flex gap-1">
              <Skeleton className="h-8 w-20 rounded-full" />
              <Skeleton className="h-8 w-28 rounded-full" />
              <Skeleton className="h-8 w-24 rounded-full" />
            </div>
          </div>
          <Skeleton className="h-9 w-64 rounded-xl" />
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <Skeleton className="h-10 w-full rounded-xl" />
              <Skeleton className="h-10 w-full rounded-xl" />
            </div>
            <div className="space-y-4">
              <Skeleton className="h-10 w-full rounded-xl" />
              <Skeleton className="h-10 w-full rounded-xl" />
            </div>
          </div>
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      </div>
    )
  }

  const { viewDef } = formData

  return (
    <>
      {/* Full-width form: break out of container padding */}
      <div className="-mx-4 sm:-mx-6 lg:-mx-8 -mt-6 lg:-mt-10">
        {/* Sticky toolbar */}
        <div className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-border/40 bg-background/95 backdrop-blur-sm px-6 py-2">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </button>

          <div className="flex items-center gap-2">
            {!editing && state?.id && (
              <PrintMenu
                model={model}
                recordIds={[state.id]}
                onSelectReport={(name) => setReportState({ open: true, reportName: name, recordIds: [state.id!] })}
              />
            )}
            {editing ? (
              <>
                <Button variant="ghost" size="sm" className="rounded-xl gap-1.5 text-muted-foreground" onClick={handleDiscard}>
                  <X className="h-3.5 w-3.5" /> Discard
                </Button>
                <Button size="sm" className="rounded-xl gap-1.5" onClick={handleSave}>
                  <Save className="h-3.5 w-3.5" /> Save
                </Button>
              </>
            ) : (
              <Button variant="outline" size="sm" className="rounded-xl gap-1.5" onClick={() => setEditing(true)}>
                <Pencil className="h-3.5 w-3.5" /> Edit
              </Button>
            )}
          </div>
        </div>

        {/* Form body from arch — add top padding to clear sticky toolbar */}
        <div className="pt-1">
        <FormRenderer
          arch={viewDef?.arch}
          fields={viewDef?.fields || {}}
          record={state.data}
          readonly={!editing}
          onFieldChange={handleFieldChange}
          onButtonClick={handleButton}
        />
        </div>
      </div>

      <DebugPanel info={{ model, viewType: 'form', viewId: formData?.viewDef?.view?.id, recordId: state?.id, record: state?.data }} />

      {hasChatter && state?.id && (
        <div className="-mx-4 sm:-mx-6 lg:-mx-8">
          <div className="px-6 py-4 border-t border-border/40">
            <Chatter model={model} resId={state.id} />
          </div>
        </div>
      )}

      {state?.id && (
        <div className="-mx-4 sm:-mx-6 lg:-mx-8">
          <div className="px-6 py-4 border-t border-border/40">
            <AttachmentPanel model={model} resId={state.id} />
          </div>
        </div>
      )}

      <WizardDialog
        open={wizardState.open}
        onClose={() => setWizardState({ open: false, model: '' })}
        wizardModel={wizardState.model}
        wizardContext={wizardState.context}
        onComplete={() => queryClient.invalidateQueries({ queryKey: ['form', model, recordId] })}
      />
      <ReportDialog
        open={reportState.open}
        onClose={() => setReportState({ open: false, reportName: '', recordIds: [] })}
        reportName={reportState.reportName}
        recordIds={reportState.recordIds}
      />
    </>
  )
}
