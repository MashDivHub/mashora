import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { PageHeader, toast } from '@/components/shared'
import { Button, Input, Skeleton, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@mashora/design-system'
import { erpClient } from '@/lib/erp-api'
import { ClipboardCheck, Search, Save, Package, MapPin } from 'lucide-react'

interface Quant {
  id: number
  product_id: [number, string]
  location_id: [number, string]
  lot_id: [number, string] | false
  quantity: number
  inventory_quantity: number
  inventory_diff_quantity: number
}

export default function InventoryAdjustment() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [modifiedIds, setModifiedIds] = useState<Set<number>>(new Set())

  const domain: unknown[] = [['location_id.usage', '=', 'internal']]
  if (search) domain.push(['product_id', 'ilike', search])

  const { data, isLoading } = useQuery({
    queryKey: ['inventory-adjustments', domain],
    queryFn: async () => {
      const { data } = await erpClient.raw.post('/inventory/adjustments', {
        domain,
        offset: 0,
        limit: 200,
        order: 'product_id asc',
      })
      return data as { records: Quant[]; total: number }
    },
  })

  const countMutation = useMutation({
    mutationFn: async ({ quantId, inventoryQuantity }: { quantId: number; inventoryQuantity: number }) => {
      const { data } = await erpClient.raw.post(`/inventory/adjustments/${quantId}/count`, {
        inventory_quantity: inventoryQuantity,
      })
      return data
    },
    onSuccess: (_, { quantId }) => {
      setModifiedIds(prev => new Set(prev).add(quantId))
      queryClient.invalidateQueries({ queryKey: ['inventory-adjustments'] })
    },
    onError: () => {
      toast('error', 'Failed to save count', 'Could not update the counted quantity.')
    },
  })

  const applyMutation = useMutation({
    mutationFn: async (quantIds: number[]) => {
      const { data } = await erpClient.raw.post('/inventory/adjustments/apply', {
        quant_ids: quantIds,
      })
      return data
    },
    onSuccess: () => {
      toast('success', 'Adjustments applied', 'Inventory has been updated.')
      setModifiedIds(new Set())
      queryClient.invalidateQueries({ queryKey: ['inventory-adjustments'] })
    },
    onError: () => {
      toast('error', 'Failed to apply', 'Could not apply inventory adjustments.')
    },
  })

  function handleCountChange(quantId: number, value: string) {
    const parsed = parseFloat(value)
    if (isNaN(parsed)) return
    countMutation.mutate({ quantId, inventoryQuantity: parsed })
  }

  function handleApply() {
    applyMutation.mutate(Array.from(modifiedIds))
  }

  const records = data?.records ?? []

  return (
    <div className="space-y-4">
      <PageHeader
        title="Inventory Adjustment"
        subtitle="Physical inventory count"
        actions={
          <Button
            onClick={handleApply}
            disabled={modifiedIds.size === 0 || applyMutation.isPending}
            className="rounded-xl gap-2"
          >
            <Save className="h-4 w-4" />
            Apply Adjustments{modifiedIds.size > 0 ? ` (${modifiedIds.size})` : ''}
          </Button>
        }
      />

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Search products..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9 rounded-xl"
        />
      </div>

      <div className="rounded-2xl border border-border/30 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Lot / Serial</TableHead>
              <TableHead className="text-right">On Hand</TableHead>
              <TableHead className="text-right">Counted</TableHead>
              <TableHead className="text-right">Difference</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : records.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-16 text-muted-foreground">
                  <div className="flex flex-col items-center gap-3 max-w-md mx-auto">
                    <ClipboardCheck className="h-10 w-10 opacity-30" />
                    <p className="text-sm font-medium">No stock found in internal locations</p>
                    <p className="text-xs">
                      Adjustments require products stored in an internal location.
                      Make sure you have products set up and at least one internal location configured.
                    </p>
                    <div className="flex flex-wrap gap-2 justify-center pt-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate('/admin/products')}
                        className="gap-1.5 rounded-xl"
                      >
                        <Package className="h-3.5 w-3.5" />
                        View Products
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate('/admin/inventory/locations')}
                        className="gap-1.5 rounded-xl"
                      >
                        <MapPin className="h-3.5 w-3.5" />
                        View Locations
                      </Button>
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              records.map(quant => {
                const diff = quant.inventory_diff_quantity
                const diffClass =
                  diff > 0 ? 'text-emerald-400' : diff < 0 ? 'text-red-400' : 'text-muted-foreground'
                return (
                  <TableRow key={quant.id}>
                    <TableCell className="font-medium text-sm">
                      {quant.product_id[1]}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {quant.location_id[1]}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {quant.lot_id ? quant.lot_id[1] : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="font-mono text-sm">
                        {Number(quant.quantity).toFixed(2)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        defaultValue={quant.inventory_quantity}
                        onBlur={e => handleCountChange(quant.id, e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            handleCountChange(quant.id, (e.target as HTMLInputElement).value)
                          }
                        }}
                        className="w-24 h-8 text-right font-mono rounded-lg ml-auto"
                        step="0.01"
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={`font-mono text-sm ${diffClass}`}>
                        {diff > 0 ? '+' : ''}{Number(diff).toFixed(2)}
                      </span>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
