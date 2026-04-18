import { useState, useEffect } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  Button, Input, Label,
} from '@mashora/design-system'
import { Plus, Loader2 } from 'lucide-react'
import { erpClient } from '@/lib/erp-api'
import { toast } from './Toast'
import { extractErrorMessage } from '@/lib/errors'
import M2OInput from './M2OInput'

export type QuickField =
  | { name: string; label: string; type: 'text' | 'email' | 'number'; required?: boolean; placeholder?: string }
  | { name: string; label: string; type: 'bool'; required?: boolean }
  | { name: string; label: string; type: 'select'; options: { value: string | number; label: string }[]; required?: boolean }
  | { name: string; label: string; type: 'm2o'; m2oModel: string; required?: boolean }

export interface QuickCreateConfig {
  fields: QuickField[]
  /** Optional: transform the search query into initial form values (e.g. name = query). */
  defaults?: (query: string) => Record<string, any>
  /** Optional: friendly title for the dialog; defaults to "Create {model}". */
  title?: string
  /** Optional: extra vals always sent alongside form fields (e.g. required system fields the user shouldn't see). */
  extraVals?: Record<string, any>
}

interface QuickCreateDialogProps {
  open: boolean
  onClose: () => void
  model: string
  initialQuery: string
  config: QuickCreateConfig
  onCreated: (record: { id: number; display_name: string }) => void
}

export default function QuickCreateDialog({ open, onClose, model, initialQuery, config, onCreated }: QuickCreateDialogProps) {
  const [form, setForm] = useState<Record<string, any>>({})
  const [saving, setSaving] = useState(false)

  // When dialog opens, seed the form with defaults
  useEffect(() => {
    if (!open) return
    const base: Record<string, any> = {}
    // Initialize bool fields to false
    for (const f of config.fields) {
      if (f.type === 'bool') base[f.name] = false
    }
    const seeded = config.defaults ? config.defaults(initialQuery) : { name: initialQuery }
    setForm({ ...base, ...seeded })
  }, [open, initialQuery, config])

  function setField(name: string, value: unknown) {
    setForm(prev => ({ ...prev, [name]: value }))
  }

  async function submit() {
    // Validate required
    for (const f of config.fields) {
      if (f.required) {
        const v = form[f.name]
        if (v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length)) {
          toast.error(`${f.label} is required`)
          return
        }
      }
    }

    // Build vals: start with extraVals, then add form fields (unwrap m2o tuples to id)
    const vals: Record<string, any> = { ...(config.extraVals || {}) }
    for (const f of config.fields) {
      const v = form[f.name]
      if (v === undefined || v === '') continue
      if (f.type === 'm2o') {
        vals[f.name] = Array.isArray(v) ? v[0] : v
      } else if (f.type === 'number') {
        const n = parseFloat(String(v))
        if (!isNaN(n)) vals[f.name] = n
      } else {
        vals[f.name] = v
      }
    }

    setSaving(true)
    try {
      const { data } = await erpClient.raw.post(`/model/${model}/create`, { vals })
      const id = data?.id
      if (!id) throw new Error('Create did not return an id')
      // Fetch display_name via name_search (cheap and consistent with M2OInput's shape)
      let displayName = String(vals.name || vals.display_name || `#${id}`)
      try {
        const { data: ns } = await erpClient.raw.post(`/model/${model}/name_search`, {
          name: '', domain: [['id', '=', id]], limit: 1,
        })
        const row = (ns?.results || ns || [])[0]
        if (row) {
          if (Array.isArray(row)) displayName = row[1]
          else if (row.display_name) displayName = row.display_name
        }
      } catch { /* ignore */ }

      toast.success('Created', displayName)
      onCreated({ id, display_name: displayName })
      onClose()
    } catch (e: unknown) {
      toast.error('Create failed', extractErrorMessage(e, 'Unknown error'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" />
            {config.title || `Create ${model}`}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {config.fields.map(f => {
            const v = form[f.name]
            return (
              <div key={f.name} className="space-y-1">
                <Label htmlFor={`qc-${f.name}`} className="text-xs">
                  {f.label}{f.required && <span className="text-destructive"> *</span>}
                </Label>
                {f.type === 'text' && (
                  <Input id={`qc-${f.name}`} value={v ?? ''}
                    placeholder={f.placeholder}
                    onChange={e => setField(f.name, e.target.value)}
                    className="h-9 text-sm" autoFocus={f.name === 'name'} />
                )}
                {f.type === 'email' && (
                  <Input id={`qc-${f.name}`} type="email" value={v ?? ''}
                    placeholder={f.placeholder}
                    onChange={e => setField(f.name, e.target.value)}
                    className="h-9 text-sm" />
                )}
                {f.type === 'number' && (
                  <Input id={`qc-${f.name}`} type="number" step="0.01" value={v ?? ''}
                    placeholder={f.placeholder}
                    onChange={e => setField(f.name, e.target.value)}
                    className="h-9 text-sm" />
                )}
                {f.type === 'bool' && (
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input id={`qc-${f.name}`} type="checkbox" checked={!!v}
                      onChange={e => setField(f.name, e.target.checked)} />
                    {f.label}
                  </label>
                )}
                {f.type === 'select' && (
                  <select id={`qc-${f.name}`} value={v ?? ''}
                    onChange={e => setField(f.name, e.target.value)}
                    className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm">
                    <option value="">—</option>
                    {f.options.map(o => (
                      <option key={String(o.value)} value={String(o.value)}>{o.label}</option>
                    ))}
                  </select>
                )}
                {f.type === 'm2o' && (
                  <M2OInput
                    value={v || false}
                    model={f.m2oModel}
                    onChange={val => setField(f.name, val)}
                    placeholder={`Select ${f.label.toLowerCase()}...`}
                    className="h-9"
                  />
                )}
              </div>
            )
          })}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="ghost" onClick={onClose} className="rounded-xl" disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={submit} className="rounded-xl gap-1.5" disabled={saving}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Presets ─────────────────────────────────────────────────────────────────

export const QUICK_CREATE_PRESETS: Record<string, QuickCreateConfig> = {
  'res.partner': {
    title: 'Create Contact',
    fields: [
      { name: 'name', label: 'Name', type: 'text', required: true },
      { name: 'is_company', label: 'Is a company', type: 'bool' },
      { name: 'email', label: 'Email', type: 'email' },
      { name: 'phone', label: 'Phone', type: 'text' },
    ],
  },
  'product.template': {
    title: 'Create Product',
    fields: [
      { name: 'name', label: 'Product Name', type: 'text', required: true },
      { name: 'type', label: 'Product Type', type: 'select', required: true, options: [
        { value: 'consu', label: 'Consumable' },
        { value: 'service', label: 'Service' },
        { value: 'product', label: 'Storable' },
      ]},
      { name: 'list_price', label: 'Sales Price', type: 'number' },
    ],
    defaults: (q) => ({ name: q, type: 'consu' }),
  },
  'product.product': {
    title: 'Create Product Variant',
    fields: [
      { name: 'name', label: 'Name', type: 'text', required: true },
    ],
  },
  'product.category': {
    title: 'Create Category',
    fields: [
      { name: 'name', label: 'Category Name', type: 'text', required: true },
    ],
  },
  'uom.uom': {
    title: 'Create Unit of Measure',
    fields: [
      { name: 'name', label: 'Name', type: 'text', required: true },
    ],
  },
  'res.company': {
    title: 'Create Company',
    fields: [
      { name: 'name', label: 'Company Name', type: 'text', required: true },
    ],
  },
  'product.tag': {
    title: 'Create Tag',
    fields: [
      { name: 'name', label: 'Tag Name', type: 'text', required: true },
    ],
  },
  'stock.location': {
    title: 'Create Location',
    fields: [
      { name: 'name', label: 'Location Name', type: 'text', required: true },
    ],
  },
  'crm.tag': {
    title: 'Create Tag',
    fields: [
      { name: 'name', label: 'Tag Name', type: 'text', required: true },
    ],
  },
  'crm.team': {
    title: 'Create Sales Team',
    fields: [
      { name: 'name', label: 'Team Name', type: 'text', required: true },
    ],
  },
  'res.users': {
    title: 'Create User',
    fields: [
      { name: 'name', label: 'Name', type: 'text', required: true },
      { name: 'login', label: 'Login', type: 'text', required: true },
      { name: 'email', label: 'Email', type: 'email' },
    ],
  },
  'account.payment.term': {
    title: 'Create Payment Term',
    fields: [
      { name: 'name', label: 'Term Name', type: 'text', required: true },
    ],
    extraVals: { sequence: 10 },
  },
}
