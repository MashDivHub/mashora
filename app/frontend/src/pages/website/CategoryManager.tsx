import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Button, Input, Label, Badge, Card, CardContent,
  cn,
} from '@mashora/design-system'
import { Tag, Plus, Pencil, Trash2, ChevronRight, FolderTree, X, Check } from 'lucide-react'
import { PageHeader, SearchBar } from '@/components/shared'
import { toast } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'

// ─── Types ──────────────────────────────────────────────────────────────────

interface Category {
  id: number
  name: string
  complete_name: string
  parent_id: [number, string] | false | null
  parent_path: string | null
  create_date: string
  write_date: string
}

const FIELDS = ['id', 'name', 'complete_name', 'parent_id', 'parent_path', 'create_date', 'write_date']

// ─── Inline edit row ────────────────────────────────────────────────────────

function CategoryRow({ cat, categories, onSaved, onDeleted }: {
  cat: Category
  categories: Category[]
  onSaved: () => void
  onDeleted: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(cat.name)
  const [parentId, setParentId] = useState<number | null>(
    Array.isArray(cat.parent_id) ? cat.parent_id[0] : null
  )
  const [busy, setBusy] = useState(false)

  async function handleSave() {
    if (!name.trim()) { toast.error('Name is required'); return }
    setBusy(true)
    try {
      await erpClient.raw.put(`/model/product.category/${cat.id}`, {
        vals: { name: name.trim(), parent_id: parentId || false },
      })
      toast.success('Category updated')
      setEditing(false)
      onSaved()
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Update failed')
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete "${cat.name}"? Products in this category will be unlinked.`)) return
    setBusy(true)
    try {
      await erpClient.raw.delete(`/model/product.category/${cat.id}`)
      toast.success('Category deleted')
      onDeleted()
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Delete failed')
    } finally {
      setBusy(false)
    }
  }

  const parentName = Array.isArray(cat.parent_id) ? cat.parent_id[1] : null
  const depth = (cat.parent_path || '').split('/').filter(Boolean).length - 1

  if (editing) {
    return (
      <tr className="border-b border-border/40 bg-accent/30">
        <td className="px-4 py-3" colSpan={2}>
          <div className="flex items-center gap-3">
            <Input value={name} onChange={e => setName(e.target.value)} className="max-w-xs" autoFocus onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false) }} />
            <select value={parentId || ''} onChange={e => setParentId(e.target.value ? Number(e.target.value) : null)} className="flex h-10 rounded-lg border border-input bg-background px-3 py-2 text-sm max-w-[200px]">
              <option value="">No parent (root)</option>
              {categories.filter(c => c.id !== cat.id).map(c => (
                <option key={c.id} value={c.id}>{c.complete_name || c.name}</option>
              ))}
            </select>
          </div>
        </td>
        <td className="px-4 py-3 text-right">
          <div className="flex items-center justify-end gap-1.5">
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 rounded-lg" onClick={() => setEditing(false)} disabled={busy}>
              <X className="h-4 w-4" />
            </Button>
            <Button size="sm" className="h-8 w-8 p-0 rounded-lg" onClick={handleSave} disabled={busy}>
              <Check className="h-4 w-4" />
            </Button>
          </div>
        </td>
      </tr>
    )
  }

  return (
    <tr className="border-b border-border/40 hover:bg-muted/30 transition-colors group">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2" style={{ paddingLeft: `${depth * 20}px` }}>
          {depth > 0 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />}
          <Tag className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="font-medium text-sm">{cat.name}</span>
        </div>
      </td>
      <td className="px-4 py-3">
        {parentName && (
          <Badge variant="secondary" className="text-xs rounded-full">{parentName}</Badge>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0 rounded-lg" onClick={() => setEditing(true)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0 rounded-lg text-destructive hover:text-destructive" onClick={handleDelete} disabled={busy}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </td>
    </tr>
  )
}

// ─── Create form ────────────────────────────────────────────────────────────

function CreateCategory({ categories, onCreated }: { categories: Category[]; onCreated: () => void }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [parentId, setParentId] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleCreate() {
    if (!name.trim()) { toast.error('Name is required'); return }
    setBusy(true)
    try {
      await erpClient.raw.post('/model/product.category/create', {
        vals: { name: name.trim(), parent_id: parentId || false },
      })
      toast.success(`Category "${name.trim()}" created`)
      setName('')
      setParentId(null)
      setOpen(false)
      onCreated()
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Create failed')
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <Button variant="outline" className="rounded-xl" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4 mr-1.5" /> New Category
      </Button>
    )
  }

  return (
    <Card className="rounded-2xl">
      <CardContent className="p-5">
        <div className="flex items-end gap-3 flex-wrap">
          <div className="space-y-2 flex-1 min-w-[200px]">
            <Label htmlFor="new-cat-name">Category Name</Label>
            <Input id="new-cat-name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Electronics" autoFocus onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setOpen(false) }} />
          </div>
          <div className="space-y-2 flex-1 min-w-[200px]">
            <Label htmlFor="new-cat-parent">Parent Category</Label>
            <select id="new-cat-parent" value={parentId || ''} onChange={e => setParentId(e.target.value ? Number(e.target.value) : null)} className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm">
              <option value="">None (root category)</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.complete_name || c.name}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleCreate} disabled={busy} className="rounded-xl">
              {busy ? 'Creating...' : 'Create'}
            </Button>
            <Button variant="ghost" onClick={() => setOpen(false)} className="rounded-xl">Cancel</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Main ───────────────────────────────────────────────────────────────────

export default function CategoryManager() {
  const [search, setSearch] = useState('')
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['product-categories', search],
    queryFn: async () => {
      const domain: any[] = []
      if (search) domain.push(['name', 'ilike', search])
      const { data } = await erpClient.raw.post('/model/product.category', {
        domain,
        fields: FIELDS,
        limit: 200,
        order: 'complete_name asc',
      })
      return data as { records: Category[]; total: number }
    },
  })

  const records = data?.records ?? []

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ['product-categories'] })
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Product Categories" subtitle="products" backTo="/admin/products" />

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <SearchBar placeholder="Search categories..." onSearch={v => setSearch(v)} />
        <CreateCategory categories={records} onCreated={refresh} />
      </div>

      {/* Stats */}
      <div className="flex gap-4 text-sm text-muted-foreground">
        <span>{records.length} categories</span>
        <span>{records.filter(c => !c.parent_id).length} root</span>
        <span>{records.filter(c => !!c.parent_id).length} sub-categories</span>
      </div>

      {/* Table */}
      <Card className="rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : records.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
            <FolderTree className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-medium">No product categories found</p>
            <p className="text-xs">Create your first category to organize products.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 bg-muted/20">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Category</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Parent</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground w-24">Actions</th>
              </tr>
            </thead>
            <tbody>
              {records.map(cat => (
                <CategoryRow key={cat.id} cat={cat} categories={records} onSaved={refresh} onDeleted={refresh} />
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}
