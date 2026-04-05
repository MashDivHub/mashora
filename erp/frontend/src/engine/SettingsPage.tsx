import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Skeleton, Tabs, TabsContent, TabsList, TabsTrigger, cn } from '@mashora/design-system'
import { Settings, Save, Loader2, CheckCircle2 } from 'lucide-react'
import { erpClient } from '@/lib/erp-api'
import FormRenderer from './views/form/FormRenderer'
import { fetchViewDefinition } from './ActionService'
import { createRecordState, updateField, type RecordState } from './state/RecordState'
import { callOnchange } from './ActionService'

export default function SettingsPage() {
  const queryClient = useQueryClient()
  const [state, setState] = useState<RecordState | null>(null)
  const [saved, setSaved] = useState(false)

  // Open settings wizard
  const { data: settingsData, isLoading: loadingSettings } = useQuery({
    queryKey: ['settings', 'open'],
    queryFn: async () => {
      const { data } = await erpClient.raw.post('/settings/open')
      return data
    },
  })

  // Get settings form view
  const { data: viewDef, isLoading: loadingView } = useQuery({
    queryKey: ['viewDef', 'res.config.settings', 'form'],
    queryFn: () => fetchViewDefinition('res.config.settings', 'form'),
    staleTime: 5 * 60 * 1000,
  })

  useEffect(() => {
    if (settingsData?.data) {
      setState(createRecordState('res.config.settings', settingsData.id, settingsData.data))
    }
  }, [settingsData])

  const applyMut = useMutation({
    mutationFn: async () => {
      if (!state) return
      const changedVals: Record<string, any> = {}
      for (const field of state.dirtyFields) {
        changedVals[field] = state.data[field]
      }
      const { data } = await erpClient.raw.post('/settings/apply', {
        wizard_id: state.id,
        vals: changedVals,
      })
      return data
    },
    onSuccess: () => {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
      queryClient.invalidateQueries({ queryKey: ['settings'] })
    },
  })

  const handleFieldChange = async (fieldName: string, value: any) => {
    if (!state) return
    const newState = updateField(state, fieldName, value)
    setState(newState)
    try {
      const result = await callOnchange('res.config.settings', state.id, fieldName, value, newState.data)
      if (result?.value) {
        setState(prev => {
          if (!prev) return prev
          return { ...prev, data: { ...prev.data, ...result.value } }
        })
      }
    } catch {}
  }

  const isLoading = loadingSettings || loadingView

  if (isLoading || !state || !viewDef) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Settings className="h-6 w-6 text-muted-foreground" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">Configuration</p>
            <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
          </div>
        </div>
        <div className="rounded-3xl border border-border/60 bg-card p-6 space-y-4">
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-3/4 rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl border border-border/70 bg-muted/60 p-3 text-muted-foreground">
            <Settings className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">Configuration</p>
            <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {saved && (
            <span className="flex items-center gap-1 text-sm text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" /> Saved
            </span>
          )}
          <Button
            size="sm"
            className="rounded-xl gap-1.5"
            onClick={() => applyMut.mutate()}
            disabled={applyMut.isPending || state.dirtyFields.size === 0}
          >
            {applyMut.isPending ? (
              <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Applying...</>
            ) : (
              <><Save className="h-3.5 w-3.5" /> Apply</>
            )}
          </Button>
        </div>
      </div>

      {/* Settings form */}
      <div className="rounded-3xl border border-border/60 bg-card shadow-[0_20px_80px_-48px_rgba(15,23,42,0.45)] overflow-hidden">
        <FormRenderer
          arch={viewDef.arch}
          fields={viewDef.fields}
          record={state.data}
          readonly={false}
          onFieldChange={handleFieldChange}
          onButtonClick={() => {}}
        />
      </div>
    </div>
  )
}
