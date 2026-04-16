import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Button, Input, Label, Badge, Card, CardContent,
} from '@mashora/design-system'
import { BoxesIcon, Plus, Pencil, Trash2, Package, Search, X } from 'lucide-react'
import { PageHeader } from '@/components/shared'
import { toast } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'

interface Bom {
  id: number
  code: string | false
  product_tmpl_id: [number, string] | number | false
  product_qty: number
  product_uom_id: [number, string] | number | false
  type: string
  active: boolean
}

const FIELDS = ['id', 'code', 'product_tmpl_id', 'product_qty', 'product_uom_id', 'type', 'active']

export default function BundleList() {
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['bundles', search],
    queryFn: async () => {
      const domain: any[] = [['type', '=', 'phantom']]
      if (search) domain.push('|', ['code', 'ilike', search], ['product_tmpl_id', 'ilike', search])
      const { data } = await erpClient.raw.post('/model/mrp.bom', {
        domain, fields: FIELDS, limit: 100, order: 'id desc',
      })
      return data as { records: Bom[]; total: number }
    },
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => erpClient.raw.delete(`/model/mrp.bom/${id}`),
    onSuccess: () => { toast.success('Bundle deleted'); queryClient.invalidateQueries({ queryKey: ['bundles'] }) },
    onError: (e: any) => toast.error(e?.response?.data?.detail || 'Delete failed'),
  })

  const records = data?.records ?? []

  return (
    <div className="space-y-6">
      <PageHeader title="Bundles / Kits" subtitle="products" backTo="/admin/products" />

      {/* Search + action bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search bundles..." className="pl-9" />
        </div>
        <Button className="rounded-xl" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-1.5" /> New Bundle
        </Button>
      </div>

      {/* Create dialog */}
      {showCreate && <CreateBundleCard onCreated={() => { queryClient.invalidateQueries({ queryKey: ['bundles'] }); setShowCreate(false) }} onCancel={() => setShowCreate(false)} />}

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>
      ) : records.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <div className="rounded-2xl border border-dashed border-border/60 bg-muted/20 p-6">
            <BoxesIcon className="h-10 w-10 text-muted-foreground/40" />
          </div>
          <div>
            <p className="text-sm font-medium">No bundles yet</p>
            <p className="text-xs text-muted-foreground mt-1">Create a kit to sell multiple products as one package.</p>
          </div>
          {!showCreate && (
            <Button variant="outline" className="rounded-xl mt-2" onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4 mr-1.5" /> Create your first bundle
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {records.map(bom => {
            const name = Array.isArray(bom.product_tmpl_id) ? bom.product_tmpl_id[1] : `Product #${bom.product_tmpl_id}`
            return (
              <Card key={bom.id} className="rounded-2xl group hover:shadow-md transition-shadow">
                <CardContent className="p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="shrink-0 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <BoxesIcon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {bom.code || 'No reference'} &middot; Qty: {bom.product_qty}
                        </p>
                      </div>
                    </div>
                    <Badge variant="info" className="text-[10px] shrink-0">Kit</Badge>
                  </div>

                  {/* Actions — visible on hover */}
                  <div className="flex gap-2 mt-4 pt-3 border-t border-border/40">
                    <Button size="sm" variant="outline" className="flex-1 rounded-lg text-xs h-8" onClick={() => navigate(`/admin/manufacturing/bom/${bom.id}`)}>
                      <Pencil className="h-3 w-3 mr-1" /> Edit Components
                    </Button>
                    <Button size="sm" variant="ghost" className="rounded-lg text-xs h-8 text-destructive hover:text-destructive" onClick={() => { if (confirm(`Delete bundle "${name}"?`)) deleteMut.mutate(bom.id) }}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Create card ────────────────────────────────────────────────────────────

function CreateBundleCard({ onCreated, onCancel }: { onCreated: () => void; onCancel: () => void }) {
  const [productSearch, setProductSearch] = useState('')
  const [productId, setProductId] = useState<number | null>(null)
  const [productName, setProductName] = useState('')
  const [code, setCode] = useState('')
  const [qty, setQty] = useState(1)
  const [busy, setBusy] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)

  const { data: products } = useQuery({
    queryKey: ['bundle-product-search', productSearch],
    queryFn: async () => {
      const { data } = await erpClient.raw.post('/model/product.template/name_search', { name: productSearch || '', limit: 10 })
      return (data || []) as [number, string][]
    },
    enabled: dropdownOpen,
  })

  async function handleCreate() {
    if (!productId) { toast.error('Select a product for the bundle'); return }
    setBusy(true)
    try {
      await erpClient.raw.post('/model/mrp.bom/create', {
        vals: { product_tmpl_id: productId, code: code.trim() || false, product_qty: qty, type: 'phantom' },
      })
      toast.success(`Bundle "${productName}" created`)
      onCreated()
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Create failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="rounded-2xl border-primary/30 shadow-lg">
      <CardContent className="p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold">New Bundle / Kit</h3>
          <button onClick={onCancel} className="text-muted-foreground hover:text-foreground transition-colors"><X className="h-4 w-4" /></button>
        </div>

        <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
          {/* Product search */}
          <div className="space-y-2 relative sm:col-span-1">
            <Label>Product</Label>
            <div className="relative">
              <Package className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                value={dropdownOpen ? productSearch : productName}
                onChange={e => { setProductSearch(e.target.value); if (!dropdownOpen) setDropdownOpen(true) }}
                onFocus={() => setDropdownOpen(true)}
                onBlur={() => setTimeout(() => setDropdownOpen(false), 200)}
                placeholder="Search product..."
              />
            </div>
            {dropdownOpen && products && products.length > 0 && (
              <div className="absolute z-50 left-0 right-0 mt-1 rounded-lg border border-border/60 bg-popover shadow-lg max-h-48 overflow-y-auto">
                {products.map(([id, name]) => (
                  <button key={id} type="button" className="w-full px-3 py-2 text-sm text-left hover:bg-accent transition-colors first:rounded-t-lg last:rounded-b-lg" onMouseDown={() => { setProductId(id); setProductName(name); setDropdownOpen(false) }}>
                    {name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="bom-code">Reference</Label>
            <Input id="bom-code" value={code} onChange={e => setCode(e.target.value)} placeholder="KIT-001" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bom-qty">Quantity</Label>
            <Input id="bom-qty" type="number" min="1" step="1" value={qty} onChange={e => setQty(parseInt(e.target.value) || 1)} />
          </div>
        </div>

        <p className="text-xs text-muted-foreground mt-3">Creates a Kit BOM. Add component products via the edit page after creation.</p>

        <div className="flex gap-2 mt-4">
          <Button onClick={handleCreate} disabled={busy || !productId} className="rounded-xl">
            <BoxesIcon className="h-4 w-4 mr-1.5" />
            {busy ? 'Creating...' : 'Create Bundle'}
          </Button>
          <Button variant="ghost" onClick={onCancel} className="rounded-xl">Cancel</Button>
        </div>
      </CardContent>
    </Card>
  )
}
