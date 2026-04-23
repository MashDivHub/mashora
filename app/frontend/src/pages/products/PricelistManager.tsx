import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Button, Input, Label, Badge, Card, CardContent,
} from '@mashora/design-system'
import { DollarSign, Plus, Pencil, Trash2, X, Check } from 'lucide-react'
import { PageHeader, SearchBar } from '@/components/shared'
import { toast } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'
import { extractErrorMessage } from '@/lib/errors'

type DomainTerm = [string, string, unknown]

interface Pricelist {
  id: number
  name: string
  active: boolean
  currency_id: [number, string] | number | false
  sequence: number
  item_count?: number
}

const FIELDS = ['id', 'name', 'active', 'currency_id', 'sequence']

function PricelistRow({ pl, onSaved, onDeleted }: {
  pl: Pricelist; onSaved: () => void; onDeleted: () => void
}) {
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(pl.name)
  const [busy, setBusy] = useState(false)

  async function handleSave() {
    if (!name.trim()) { toast.error('Name is required'); return }
    setBusy(true)
    try {
      await erpClient.raw.put(`/model/product.pricelist/${pl.id}`, { vals: { name: name.trim() } })
      toast.success('Pricelist updated')
      setEditing(false)
      onSaved()
    } catch (e: unknown) {
      toast.error(extractErrorMessage(e, 'Update failed'))
    } finally { setBusy(false) }
  }

  async function handleDelete() {
    if (!confirm(`Delete pricelist "${pl.name}"?`)) return
    setBusy(true)
    try {
      await erpClient.raw.delete(`/model/product.pricelist/${pl.id}`)
      toast.success('Pricelist deleted')
      onDeleted()
    } catch (e: unknown) {
      toast.error(extractErrorMessage(e, 'Delete failed'))
    } finally { setBusy(false) }
  }

  const currency = Array.isArray(pl.currency_id) ? pl.currency_id[1] : ''

  if (editing) {
    return (
      <tr className="border-b border-border/40 bg-accent/30" onClick={e => e.stopPropagation()}>
        <td className="px-4 py-3" colSpan={3}>
          <div className="flex items-center gap-3">
            <Input value={name} onChange={e => setName(e.target.value)} className="max-w-xs" autoFocus onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false) }} />
          </div>
        </td>
        <td className="px-4 py-3 text-right">
          <div className="flex items-center justify-end gap-1.5">
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 rounded-lg" onClick={() => setEditing(false)} disabled={busy}><X className="h-4 w-4" /></Button>
            <Button size="sm" className="h-8 w-8 p-0 rounded-lg" onClick={handleSave} disabled={busy}><Check className="h-4 w-4" /></Button>
          </div>
        </td>
      </tr>
    )
  }

  return (
    <tr
      className="border-b border-border/40 hover:bg-muted/30 transition-colors group cursor-pointer"
      onClick={() => navigate(`/admin/products/pricelists/${pl.id}`)}
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="font-medium text-sm">{pl.name}</span>
        </div>
      </td>
      <td className="px-4 py-3">
        <span className="text-sm text-muted-foreground">{currency}</span>
      </td>
      <td className="px-4 py-3">
        <Badge variant={pl.active ? 'success' : 'secondary'} className="text-xs">{pl.active ? 'Active' : 'Archived'}</Badge>
      </td>
      <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0 rounded-lg" onClick={() => setEditing(true)}><Pencil className="h-3.5 w-3.5" /></Button>
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0 rounded-lg text-destructive hover:text-destructive" onClick={handleDelete} disabled={busy}><Trash2 className="h-3.5 w-3.5" /></Button>
        </div>
      </td>
    </tr>
  )
}

function CreatePricelist({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleCreate() {
    if (!name.trim()) { toast.error('Name is required'); return }
    setBusy(true)
    try {
      await erpClient.raw.post('/model/product.pricelist/create', { vals: { name: name.trim() } })
      toast.success(`Pricelist "${name.trim()}" created`)
      setName('')
      setOpen(false)
      onCreated()
    } catch (e: unknown) {
      toast.error(extractErrorMessage(e, 'Create failed'))
    } finally { setBusy(false) }
  }

  if (!open) {
    return <Button variant="outline" className="rounded-xl" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1.5" /> New Pricelist</Button>
  }

  return (
    <Card className="rounded-2xl">
      <CardContent className="p-5">
        <div className="flex items-end gap-3 flex-wrap">
          <div className="space-y-2 flex-1 min-w-[200px]">
            <Label htmlFor="new-pl">Pricelist Name</Label>
            <Input id="new-pl" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. VIP Customers" autoFocus onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setOpen(false) }} />
          </div>
          <div className="flex gap-2">
            <Button onClick={handleCreate} disabled={busy} className="rounded-xl">{busy ? 'Creating...' : 'Create'}</Button>
            <Button variant="ghost" onClick={() => setOpen(false)} className="rounded-xl">Cancel</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function PricelistManager() {
  const [search, setSearch] = useState('')
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['pricelists', search],
    queryFn: async () => {
      const domain: DomainTerm[] = []
      if (search) domain.push(['name', 'ilike', search])
      const { data } = await erpClient.raw.post('/model/product.pricelist', { domain, fields: FIELDS, limit: 100, order: 'sequence asc' })
      return data as { records: Pricelist[]; total: number }
    },
  })

  const records = data?.records ?? []
  function refresh() { queryClient.invalidateQueries({ queryKey: ['pricelists'] }) }

  return (
    <div className="space-y-5">
      <PageHeader title="Pricelists" subtitle="products" backTo="/admin/products" />
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <SearchBar placeholder="Search pricelists..." onSearch={v => setSearch(v)} />
        <CreatePricelist onCreated={refresh} />
      </div>
      <Card className="rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>
        ) : records.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <div className="rounded-2xl bg-primary/10 p-3 text-primary">
              <DollarSign className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-semibold">No pricelists yet</p>
              <p className="text-xs text-muted-foreground mt-1">Create your first pricelist to manage tiered or customer-specific pricing.</p>
            </div>
            <Button
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="rounded-xl gap-2 mt-1"
            >
              <Plus className="h-4 w-4" /> Create First Pricelist
            </Button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 bg-muted/20">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pricelist</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Currency</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground w-24">Actions</th>
              </tr>
            </thead>
            <tbody>
              {records.map(pl => <PricelistRow key={pl.id} pl={pl} onSaved={refresh} onDeleted={refresh} />)}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}
