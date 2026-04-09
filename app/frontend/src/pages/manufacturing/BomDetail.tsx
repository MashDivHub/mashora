import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Badge, Skeleton,
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@mashora/design-system'
import { PageHeader } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'
import { Layers } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface BomLine {
  id: number
  product_id: [number, string]
  product_qty: number
  product_uom_id: [number, string]
  sequence: number
}

interface BomDetail {
  id: number
  code: string | false
  product_tmpl_id: [number, string]
  product_qty: number
  product_uom_id: [number, string]
  type: 'normal' | 'phantom'
  company_id: [number, string]
  lines: BomLine[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPE_BADGE: Record<string, { label: string; variant: string }> = {
  normal:  { label: 'Manufacture', variant: 'default' },
  phantom: { label: 'Kit',         variant: 'info' },
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function m2o(val: [number, string] | false | undefined): string {
  return Array.isArray(val) ? val[1] : '—'
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4 py-2 border-b border-border/20 last:border-0">
      <span className="w-28 shrink-0 text-xs font-medium text-muted-foreground pt-0.5">{label}</span>
      <span className="text-sm">{children}</span>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

function BomDetailView({ id }: { id: number }) {
  const { data: bom, isLoading } = useQuery<BomDetail>({
    queryKey: ['bom', id],
    queryFn: () => erpClient.raw.get(`/manufacturing/boms/${id}`).then((r) => r.data),
  })

  if (isLoading || !bom) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    )
  }

  const typeBadge = TYPE_BADGE[bom.type] || { label: bom.type, variant: 'secondary' }
  const title = bom.code
    ? `${m2o(bom.product_tmpl_id)} · ${bom.code}`
    : m2o(bom.product_tmpl_id)

  const sortedLines = [...(bom.lines ?? [])].sort((a, b) => a.sequence - b.sequence)

  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        subtitle="Bill of Materials"
        backTo="/manufacturing/bom"
      />

      {/* Info card */}
      <div className="rounded-2xl border border-border/30 bg-card/50 p-6">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-4">
          General Information
        </p>
        <InfoRow label="Product">{m2o(bom.product_tmpl_id)}</InfoRow>
        <InfoRow label="Reference">{bom.code || '—'}</InfoRow>
        <InfoRow label="Quantity">
          {bom.product_qty} {m2o(bom.product_uom_id)}
        </InfoRow>
        <InfoRow label="UoM">{m2o(bom.product_uom_id)}</InfoRow>
        <InfoRow label="Type">
          <Badge variant={typeBadge.variant as any} className="rounded-full text-xs">
            {typeBadge.label}
          </Badge>
        </InfoRow>
        <InfoRow label="Company">{m2o(bom.company_id)}</InfoRow>
      </div>

      {/* Components card */}
      <div className="rounded-2xl border border-border/30 bg-card/50 p-6">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-4">
          Components
        </p>

        {sortedLines.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
            <Layers className="h-8 w-8 opacity-40" />
            <p className="text-sm">No components defined</p>
          </div>
        ) : (
          <div className="rounded-xl border border-border/40 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-border/40">
                  <TableHead className="h-9 w-14 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                    #
                  </TableHead>
                  <TableHead className="h-9 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                    Component
                  </TableHead>
                  <TableHead className="h-9 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                    Quantity
                  </TableHead>
                  <TableHead className="h-9 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                    UoM
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedLines.map((line) => (
                  <TableRow key={line.id} className="border-border/30">
                    <TableCell className="py-2.5 text-sm text-muted-foreground tabular-nums w-14">
                      {line.sequence}
                    </TableCell>
                    <TableCell className="py-2.5 text-sm font-medium">
                      {m2o(line.product_id)}
                    </TableCell>
                    <TableCell className="py-2.5 text-sm text-right tabular-nums">
                      {line.product_qty}
                    </TableCell>
                    <TableCell className="py-2.5 text-sm text-muted-foreground">
                      {m2o(line.product_uom_id)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Page export ──────────────────────────────────────────────────────────────

export default function BomDetail() {
  const { id } = useParams<{ id: string }>()
  const numId = parseInt(id || '0')

  if (!numId) {
    return (
      <div className="flex flex-col items-center gap-2 py-16 text-center">
        <Layers className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm font-medium">Invalid Bill of Materials ID</p>
      </div>
    )
  }

  return <BomDetailView id={numId} />
}
