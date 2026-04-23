import { useMemo, useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, Button,
} from '@mashora/design-system'
import { Plus, Minus, ImageIcon, Package } from 'lucide-react'
import { erpClient } from '@/lib/erp-api'
import { fmtMoney, imageSrc, type AttributeLine, type Product, type Variant } from './types'

interface VariantPickerProps {
  product: Product | null
  open: boolean
  onClose: () => void
  onAdd: (opts: { variantId: number; variantName: string; price: number; qty: number; image_1920: string | null }) => void
}

export default function VariantPicker({ product, open, onClose, onAdd }: VariantPickerProps) {
  const [qty, setQty] = useState(1)
  const [selected, setSelected] = useState<Record<number, number>>({})

  const productId = product?.id ?? null

  const { data: lines = [] } = useQuery<AttributeLine[]>({
    queryKey: ['pos-variant-lines', productId],
    enabled: open && !!productId,
    queryFn: async () => {
      const { data } = await erpClient.raw.get(`/website/products/${productId}/attribute-lines`)
      if (Array.isArray(data)) return data as AttributeLine[]
      if (Array.isArray(data?.records)) return data.records as AttributeLine[]
      return []
    },
  })

  const { data: variants = [] } = useQuery<Variant[]>({
    queryKey: ['pos-variants', productId],
    enabled: open && !!productId,
    queryFn: async () => {
      const { data } = await erpClient.raw.get(`/website/products/${productId}/variants`)
      if (Array.isArray(data)) return data as Variant[]
      if (Array.isArray(data?.records)) return data.records as Variant[]
      return []
    },
  })

  // Reset when opening a new product
  useEffect(() => {
    if (!open || !product) return
    setQty(1)
    const seed: Record<number, number> = {}
    for (const line of lines) {
      const values = line.value_ids ?? line.values ?? []
      if (values.length > 0) {
        const lineId = typeof line.attribute_id === 'number' ? line.attribute_id : line.attribute_id?.[0]
        if (lineId != null) seed[lineId] = values[0].id
      }
    }
    setSelected(seed)
  }, [open, product, lines])

  // Resolve the chosen variant by matching selected value IDs
  const chosenVariant: Variant | null = useMemo(() => {
    const picked = Object.values(selected)
    if (picked.length === 0) return variants[0] ?? null
    return (
      variants.find(v =>
        picked.every(id => (v.product_template_attribute_value_ids ?? []).includes(id))
      ) ?? null
    )
  }, [variants, selected])

  const basePrice = product?.list_price ?? product?.price ?? 0
  const price = chosenVariant?.price ?? chosenVariant?.list_price ?? basePrice

  if (!product) return null

  const img = imageSrc(chosenVariant?.image_1920 ?? product.image_1920)

  function handleAdd() {
    if (!product) return
    onAdd({
      variantId: chosenVariant?.id ?? product.id,
      variantName: chosenVariant?.name ?? product.name,
      price,
      qty,
      image_1920: img,
    })
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-2xl rounded-2xl">
        <DialogHeader>
          <DialogTitle>{product.name}</DialogTitle>
        </DialogHeader>

        <div className="grid sm:grid-cols-[200px_1fr] gap-5">
          <div className="aspect-square rounded-2xl overflow-hidden bg-muted/40 flex items-center justify-center">
            {img ? (
              <img src={img} alt={product.name} className="h-full w-full object-cover" />
            ) : (
              <ImageIcon className="h-12 w-12 text-muted-foreground/40" />
            )}
          </div>

          <div className="space-y-4">
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-3xl font-bold tabular-nums">{fmtMoney(price)}</span>
              {chosenVariant?.qty_available != null && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Package className="h-3.5 w-3.5" />
                  {chosenVariant.qty_available} in stock
                </span>
              )}
            </div>

            {lines.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No options — just pick a quantity.
              </p>
            )}

            {lines.map(line => {
              const attrId = typeof line.attribute_id === 'number'
                ? line.attribute_id
                : Array.isArray(line.attribute_id) ? line.attribute_id[0] : 0
              const attrName = line.attribute_name
                ?? (Array.isArray(line.attribute_id) ? line.attribute_id[1] : `Attribute ${attrId}`)
              const values = line.value_ids ?? line.values ?? []
              const isColor = /colou?r/i.test(attrName)

              return (
                <div key={attrId} className="space-y-1.5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {attrName}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {values.map(v => {
                      const isSel = selected[attrId] === v.id
                      if (isColor && v.html_color) {
                        return (
                          <button
                            key={v.id}
                            onClick={() => setSelected(prev => ({ ...prev, [attrId]: v.id }))}
                            title={v.name}
                            style={{ background: v.html_color }}
                            className={`h-9 w-9 rounded-full border-2 transition-all duration-200 ${
                              isSel ? 'border-emerald-500 scale-110' : 'border-border/40'
                            }`}
                            aria-label={v.name}
                            aria-pressed={isSel}
                          />
                        )
                      }
                      return (
                        <button
                          key={v.id}
                          onClick={() => setSelected(prev => ({ ...prev, [attrId]: v.id }))}
                          className={`rounded-xl border px-3 py-1.5 text-sm font-medium transition-all duration-200 ${
                            isSel
                              ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                              : 'border-border/40 bg-muted/30 text-foreground hover:bg-muted/60'
                          }`}
                          aria-pressed={isSel}
                        >
                          {v.name}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}

            <div className="pt-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Quantity</p>
              <div className="inline-flex items-center gap-2">
                <button
                  onClick={() => setQty(q => Math.max(1, q - 1))}
                  className="h-10 w-10 rounded-xl border border-border/40 bg-muted/30 flex items-center justify-center hover:bg-muted/60 transition-all duration-200"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="w-12 text-center text-lg font-semibold tabular-nums">{qty}</span>
                <button
                  onClick={() => setQty(q => q + 1)}
                  className="h-10 w-10 rounded-xl border border-border/40 bg-muted/30 flex items-center justify-center hover:bg-muted/60 transition-all duration-200"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" className="rounded-xl" onClick={onClose}>Cancel</Button>
          <Button
            className="rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white"
            onClick={handleAdd}
          >
            Add to order · {fmtMoney(price * qty)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
