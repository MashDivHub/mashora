import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, Button, Skeleton } from '@mashora/design-system'
import { useQueryClient } from '@tanstack/react-query'
import { erpClient } from '@/lib/erp-api'
import { fetchViewDefinition } from '../ActionService'
import FormRenderer from '../views/form/FormRenderer'
import { createRecordState, updateField, mergeOnchangeResult, type RecordState } from '../state/RecordState'
import { callOnchange } from '../ActionService'

interface WizardDialogProps {
  open: boolean
  onClose: () => void
  wizardModel: string
  wizardContext?: Record<string, any>
  onComplete?: () => void
}

export default function WizardDialog({ open, onClose, wizardModel, wizardContext, onComplete }: WizardDialogProps) {
  const queryClient = useQueryClient()
  const [viewDef, setViewDef] = useState<any>(null)
  const [state, setState] = useState<RecordState | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!open) return
    setLoading(true)

    async function init() {
      try {
        const vd = await fetchViewDefinition(wizardModel, 'form')
        setViewDef(vd)

        // Create wizard record
        const { data } = await erpClient.raw.post(`/wizard/${wizardModel}`, {
          context: wizardContext || {},
        })
        setState(createRecordState(wizardModel, data.id, data))
      } catch (e) {
        console.error('Failed to initialize wizard:', e)
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [open, wizardModel, wizardContext])

  const handleFieldChange = async (fieldName: string, value: any) => {
    if (!state) return
    const newState = updateField(state, fieldName, value)
    setState(newState)

    try {
      const result = await callOnchange(wizardModel, state.id, fieldName, value, newState.data)
      if (result?.value) setState(prev => prev ? mergeOnchangeResult(prev, result.value) : prev)
    } catch {}
  }

  const handleButton = async (method: string) => {
    if (!state?.id) return
    try {
      // Update wizard with current values first
      await erpClient.raw.put(`/wizard/${wizardModel}/${state.id}`, {
        vals: state.data,
      })
      // Execute the action
      await erpClient.raw.post(`/wizard/${wizardModel}/${state.id}/${method}`)

      queryClient.invalidateQueries()
      onComplete?.()
      onClose()
    } catch (e) {
      console.error('Wizard action failed:', e)
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="max-w-2xl rounded-3xl">
        <DialogHeader>
          <DialogTitle>{viewDef?.view?.name || wizardModel.replace(/\./g, ' ')}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="space-y-3 p-4">
            <Skeleton className="h-10 w-full rounded-xl" />
            <Skeleton className="h-10 w-full rounded-xl" />
            <Skeleton className="h-10 w-3/4 rounded-xl" />
          </div>
        ) : viewDef && state ? (
          <div className="py-2">
            <FormRenderer
              arch={viewDef.arch}
              fields={viewDef.fields}
              record={state.data}
              readonly={false}
              onFieldChange={handleFieldChange}
              onButtonClick={handleButton}
            />
          </div>
        ) : (
          <div className="p-4 text-sm text-destructive">Failed to load wizard</div>
        )}
      </DialogContent>
    </Dialog>
  )
}
