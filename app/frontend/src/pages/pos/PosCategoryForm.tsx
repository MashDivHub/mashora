import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Button, Input, Label, Skeleton } from '@mashora/design-system'
import { ArrowLeft, Save, Trash2, Check, Tags, ChevronRight } from 'lucide-react'
import { M2OInput, toast, ConfirmDialog } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'
import { extractErrorMessage } from '@/lib/errors'
import { CATEGORY_COLORS } from './utils'

type M2OValue = [number, string] | false | null | undefined

interface CategoryFormState {
  name: string
  parent_id: M2OValue
  sequence: number
  color: number
}

const EMPTY: CategoryFormState = {
  name: '',
  parent_id: false,
  sequence: 10,
  color: 0,
}

const COLOR_LABELS = [
  'Slate', 'Red', 'Amber', 'Emerald', 'Cyan',
  'Blue', 'Violet', 'Pink', 'Fuchsia',
]

function m2oFromId(v: unknown): M2OValue {
  if (Array.isArray(v)) return v as [number, string]
  if (typeof v === 'number') return [v, ''] as [number, string]
  return false
}
function m2oId(v: M2OValue): number | null {
  return Array.isArray(v) ? Number(v[0]) : null
}

export default function PosCategoryForm() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isNew = !id || id === 'new'
  const recordId = isNew ? null : parseInt(id || '0')
  const [form, setForm] = useState<CategoryFormState>(EMPTY)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const setField = <K extends keyof CategoryFormState>(k: K, v: CategoryFormState[K]) =>
    setForm(p => ({ ...p, [k]: v }))

  const { data: record, isLoading } = useQuery({
    queryKey: ['pos-category', recordId],
    queryFn: async () => {
      if (isNew) return null
      const { data } = await erpClient.raw.get(`/pos/categories/${recordId}`)
      return data
    },
    enabled: !isNew,
  })

  useEffect(() => {
    if (record) {
      setForm({
        name: record.name ?? '',
        parent_id: m2oFromId(record.parent_id),
        sequence: typeof record.sequence === 'number' ? record.sequence : 10,
        color: typeof record.color === 'number' ? record.color : 0,
      })
    }
  }, [record])

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) {
        toast.error('Validation Error', 'Name is required')
        throw new Error('Validation failed')
      }
      const parentId = m2oId(form.parent_id)
      if (parentId != null && recordId != null && parentId === recordId) {
        toast.error('Validation Error', 'A category cannot be its own parent.')
        throw new Error('Validation failed')
      }
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        parent_id: parentId,
        sequence: form.sequence,
        color: form.color,
      }
      for (const k of Object.keys(payload)) if (payload[k] === null) delete payload[k]
      if (isNew) {
        const { data } = await erpClient.raw.post('/pos/categories', payload)
        return data
      }
      const { data } = await erpClient.raw.put(`/pos/categories/${recordId}`, payload)
      return data
    },
    onSuccess: () => {
      toast.success(isNew ? 'Category created' : 'Category updated')
      navigate('/admin/pos/categories')
    },
    onError: (e: unknown) => {
      if (e instanceof Error && e.message === 'Validation failed') return
      toast.error('Save failed', extractErrorMessage(e))
    },
  })

  const deleteMut = useMutation({
    mutationFn: async () => {
      if (!recordId) return
      await erpClient.raw.delete(`/pos/categories/${recordId}`)
    },
    onSuccess: () => {
      toast.success('Category deleted')
      navigate('/admin/pos/categories')
    },
    onError: (e: unknown) => toast.error('Delete failed', extractErrorMessage(e)),
  })

  if (isLoading && !isNew) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-8 space-y-6">
        <Skeleton className="h-10 w-64 rounded-xl" />
        <Skeleton className="h-80 w-full rounded-2xl" />
      </div>
    )
  }

  const nameMissing = !form.name.trim()

  return (
    <div className="mx-auto max-w-4xl px-6 py-8 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <button onClick={() => navigate('/admin/pos')} className="hover:text-foreground transition-colors">POS</button>
            <ChevronRight className="h-3 w-3" />
            <button onClick={() => navigate('/admin/pos/categories')} className="hover:text-foreground transition-colors">Categories</button>
            <ChevronRight className="h-3 w-3" />
            <span className="text-foreground">{isNew ? 'New' : 'Edit'}</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            {isNew ? 'New Category' : form.name || 'Edit Category'}
          </h1>
          <p className="text-sm text-muted-foreground">
            Organize your POS products into visual groups on the register.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate('/admin/pos/categories')} className="gap-2 rounded-xl">
            <ArrowLeft className="h-4 w-4" /> Cancel
          </Button>
          {!isNew && (
            <Button variant="outline" onClick={() => setDeleteOpen(true)} className="gap-2 rounded-xl text-rose-500 hover:text-rose-600 hover:border-rose-500/40">
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          )}
          <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending} className="gap-2 rounded-xl">
            <Save className="h-4 w-4" />
            {saveMut.isPending ? 'Saving…' : isNew ? 'Create' : 'Save'}
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-border/40 bg-card p-6 space-y-5 transition-all duration-200 hover:shadow-sm">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-primary/10 p-2 text-primary shrink-0">
            <Tags className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold tracking-tight">Category details</h3>
            <p className="text-xs text-muted-foreground">Name, parent, sequence, and display color.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              value={form.name}
              onChange={e => setField('name', e.target.value)}
              placeholder="Drinks, Pizza..."
              className={`rounded-xl h-9 ${nameMissing ? 'border-rose-500/60 focus-visible:ring-rose-500/30' : ''}`}
            />
            {nameMissing && <p className="text-[11px] text-rose-500">Required</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Parent Category</Label>
            <M2OInput
              value={form.parent_id}
              model="pos.category"
              onChange={v => setField('parent_id', v)}
              placeholder="No parent..."
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sequence">Sequence</Label>
            <Input
              id="sequence"
              type="number"
              value={form.sequence}
              onChange={e => setField('sequence', parseInt(e.target.value || '0', 10))}
              className="rounded-xl h-9 tabular-nums"
            />
          </div>
        </div>

        <div className="border-t border-border/40 pt-5 space-y-3">
          <div>
            <Label>Color</Label>
            <p className="text-xs text-muted-foreground">Pick a display color for the category tile.</p>
          </div>
          <div className="grid grid-cols-3 md:grid-cols-9 gap-2">
            {CATEGORY_COLORS.map((cls, idx) => {
              const selected = form.color === idx
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setField('color', idx)}
                  aria-label={`Color ${COLOR_LABELS[idx] ?? idx}`}
                  className={`aspect-square rounded-xl border flex items-center justify-center transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${cls} ${selected ? 'ring-2 ring-primary ring-offset-2 ring-offset-background border-primary' : 'border-border/40'}`}
                >
                  {selected && <Check className="h-4 w-4 text-white drop-shadow-sm" />}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => { setDeleteOpen(false); deleteMut.mutate() }}
        title="Delete this category?"
        message="Products currently in this category will lose their POS category. Sub-categories will become root categories."
        variant="danger"
        confirmLabel="Delete"
        loading={deleteMut.isPending}
      />
    </div>
  )
}
