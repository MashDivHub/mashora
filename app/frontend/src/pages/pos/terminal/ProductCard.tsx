import { Plus, ImageIcon } from 'lucide-react'
import { categoryColor, fmtMoney, imageSrc, type Product, type PosCategory } from './types'

interface ProductCardProps {
  product: Product
  category?: PosCategory | null
  onClick: () => void
  onContextMenu?: (e: React.MouseEvent) => void
}

export default function ProductCard({ product, category, onClick, onContextMenu }: ProductCardProps) {
  const img = imageSrc(product.image_1920)
  const price = product.list_price ?? product.price ?? 0
  const color = categoryColor(category?.color ?? null)

  return (
    <button
      onClick={onClick}
      onContextMenu={onContextMenu}
      className="group relative aspect-[4/5] rounded-2xl overflow-hidden border border-border/40 bg-card text-left cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-xl hover:border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      {/* Category color stripe */}
      <span
        aria-hidden
        className="absolute left-0 top-0 bottom-0 w-1"
        style={{ backgroundColor: color }}
      />

      {/* Image area (top ~2/3) */}
      <div className="relative h-[62%] w-full overflow-hidden bg-muted/40">
        {img ? (
          <img
            src={img}
            alt={product.name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div
            className="h-full w-full flex items-center justify-center"
            style={{
              background: `linear-gradient(135deg, ${color}33, ${color}11)`,
            }}
          >
            <ImageIcon className="h-10 w-10 text-muted-foreground/40" />
          </div>
        )}

        {/* Add overlay btn */}
        <span className="pointer-events-none absolute bottom-2 right-2 h-9 w-9 rounded-full bg-emerald-500 text-white flex items-center justify-center opacity-0 translate-y-1 transition-all duration-200 group-hover:opacity-100 group-hover:translate-y-0 shadow-lg">
          <Plus className="h-5 w-5" />
        </span>
      </div>

      {/* Bottom info area */}
      <div className="absolute inset-x-0 bottom-0 h-[38%] px-3 py-2.5 flex flex-col justify-between bg-gradient-to-b from-card/80 to-card backdrop-blur">
        <p className="text-[13px] font-medium leading-snug line-clamp-2 text-foreground">
          {product.name}
        </p>
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-lg font-bold tabular-nums">{fmtMoney(price)}</span>
          {product.default_code && (
            <span className="text-[10px] text-muted-foreground font-mono truncate">
              {product.default_code}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}
