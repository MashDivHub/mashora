import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Input, Textarea, Button, Skeleton, Badge,
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Label,
} from '@mashora/design-system'
import { Pencil, Plus, Trash2, FileText } from 'lucide-react'
import {
  DataTable, PageHeader, toast,
  type Column,
} from '@/components/shared'
import { erpClient } from '@/lib/erp-api'
import { extractErrorMessage } from '@/lib/errors'

interface TemplateRow {
  id: number
  name: string
  code: string | false
  recurring_interval: number
  recurring_rule_type: string
  auto_close_limit: number | false
  active: boolean
}

const RULE_TYPES = [
  { value: 'day', label: 'Day(s)' },
  { value: 'week', label: 'Week(s)' },
  { value: 'month', label: 'Month(s)' },
  { value: 'year', label: 'Year(s)' },
]

const emptyForm = (): Partial<TemplateRow> & { description?: string } => ({
  name: '',
  code: '',
  recurring_interval: 1,
  recurring_rule_type: 'month',
  description: '',
})

export default function SubscriptionTemplateList() {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<Record<string, unknown>>(emptyForm())
  const asStr = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v))
  const asNum = (v: unknown): number | undefined => {
    if (typeof v === 'number') return v
    if (typeof v === 'string' && v.trim() !== '') { const n = Number(v); return isNaN(n) ? undefined : n }
    return undefined
  }

  const { data, isLoading } = useQuery({
    queryKey: ['subscription-templates'],
    queryFn: async () => {
      const { data } = await erpClient.raw.post('/model/sale.subscription.template', {
        fields: ['id', 'name', 'code', 'recurring_interval', 'recurring_rule_type', 'auto_close_limit', 'active'],
        limit: 200,
        order: 'name asc',
      })
      return data
    },
  })

  const setField = (n: string, v: unknown) => setForm((p) => ({ ...p, [n]: v }))

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!asStr(form.name).trim()) {
        toast.error('Validation Error', 'Name is required')
        throw new Error('Validation failed')
      }
      const vals: Record<string, unknown> = {
        name: asStr(form.name),
        code: asStr(form.code) || undefined,
        description: asStr(form.description) || undefined,
        recurring_interval: asNum(form.recurring_interval) || 1,
        recurring_rule_type: asStr(form.recurring_rule_type) || 'month',
        auto_close_limit: asNum(form.auto_close_limit) || undefined,
      }
      for (const k of Object.keys(vals)) if (vals[k] === undefined) delete vals[k]
      if (form.id) {
        await erpClient.raw.put(`/model/sale.subscription.template/${form.id}`, { vals })
      } else {
        await erpClient.raw.post('/model/sale.subscription.template/create', { vals })
      }
    },
    onSuccess: () => {
      toast.success('Saved', 'Template saved')
      setOpen(false)
      setForm(emptyForm())
      queryClient.invalidateQueries({ queryKey: ['subscription-templates'] })
    },
    onError: (e: unknown) => {
      if (e instanceof Error && e.message === 'Validation failed') return
      toast.error('Save Failed', extractErrorMessage(e))
    },
  })

  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      await erpClient.raw.delete(`/model/sale.subscription.template/${id}`)
    },
    onSuccess: () => {
      toast.success('Deleted', 'Template removed')
      queryClient.invalidateQueries({ queryKey: ['subscription-templates'] })
    },
    onError: (e: unknown) => toast.error('Delete Failed', extractErrorMessage(e)),
  })

  const records: TemplateRow[] = data?.records || []

  const columns: Column<TemplateRow>[] = [
    { key: 'name', label: 'Name', render: (v) => <span className="font-medium">{String(v)}</span> },
    { key: 'code', label: 'Code', format: (v) => v || '—' },
    {
      key: 'recurring_interval', label: 'Recurrence', align: 'center',
      render: (_v, row) => (
        <span className="text-sm">
          Every {row.recurring_interval} {RULE_TYPES.find(t => t.value === row.recurring_rule_type)?.label || row.recurring_rule_type}
        </span>
      ),
    },
    { key: 'auto_close_limit', label: 'Auto-close', align: 'center', format: (v) => v ? `${v} attempts` : '—' },
    {
      key: 'active', label: 'Status',
      render: (v) => v
        ? <Badge variant="success" className="rounded-full text-xs">Active</Badge>
        : <Badge variant="secondary" className="rounded-full text-xs">Archived</Badge>,
    },
    {
      key: 'id', label: 'Actions', align: 'right',
      render: (_v, row) => (
        <div className="flex items-center gap-1 justify-end">
          <Button variant="ghost" size="sm" className="rounded-xl gap-1.5" onClick={(e) => { e.stopPropagation(); setForm({ ...row }); setOpen(true) }}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" className="rounded-xl gap-1.5 text-destructive" onClick={(e) => {
            e.stopPropagation()
            if (confirm(`Delete template "${row.name}"?`)) deleteMut.mutate(row.id)
          }}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <PageHeader
        title="Subscription Templates"
        subtitle="recurring plan presets"
        onNew={() => { setForm(emptyForm()); setOpen(true) }}
      />

      {isLoading ? (
        <Skeleton className="h-64 w-full rounded-2xl" />
      ) : (
        <DataTable
          columns={columns}
          data={records}
          loading={isLoading}
          emptyMessage="No templates yet"
          emptyIcon={<FileText className="h-10 w-10" />}
        />
      )}

      <Dialog open={open} onOpenChange={(v) => !v && setOpen(false)}>
        <DialogContent className="sm:max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle>{form.id != null && form.id !== false ? 'Edit Template' : 'New Template'}</DialogTitle>
            <DialogDescription>Define a recurring plan preset.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">Name *</Label>
              <Input value={asStr(form.name)} onChange={e => setField('name', e.target.value)} className="rounded-xl h-9 mt-1" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Code</Label>
              <Input value={asStr(form.code)} onChange={e => setField('code', e.target.value)} className="rounded-xl h-9 mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs text-muted-foreground">Interval</Label>
                <Input type="number" min="1" value={asNum(form.recurring_interval) ?? 1} onChange={e => setField('recurring_interval', parseInt(e.target.value) || 1)} className="rounded-xl h-9 mt-1" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Rule Type</Label>
                <select
                  value={asStr(form.recurring_rule_type) || 'month'}
                  onChange={e => setField('recurring_rule_type', e.target.value)}
                  className="w-full mt-1 rounded-xl h-9 border border-input bg-background px-3 text-sm"
                >
                  {RULE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Auto-close Limit</Label>
              <Input type="number" value={asNum(form.auto_close_limit) ?? ''} onChange={e => setField('auto_close_limit', parseInt(e.target.value) || 0)} className="rounded-xl h-9 mt-1" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Description</Label>
              <Textarea value={asStr(form.description)} onChange={e => setField('description', e.target.value)} rows={4} className="rounded-xl mt-1" />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setOpen(false)} className="rounded-xl" disabled={saveMut.isPending}>Cancel</Button>
            <Button onClick={() => saveMut.mutate()} className="rounded-xl gap-1.5" disabled={saveMut.isPending}>
              <Plus className="h-3.5 w-3.5" /> {saveMut.isPending ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
