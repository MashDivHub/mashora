import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Button, Badge, Skeleton, StatusBar,
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
  Input, Label, CardTitle,
  cn,
} from '@mashora/design-system'
import {
  ArrowLeft, Check, PackageCheck, ClipboardCheck, Undo2, Ban, ArrowRight,
  MapPin, Calendar, FileText, User, Truck, AlertCircle,
} from 'lucide-react'
import { erpClient } from '@/lib/erp-api'
import { useState } from 'react'

const pickingStates = [
  { value: 'draft',     label: 'Draft' },
  { value: 'confirmed', label: 'Waiting' },
  { value: 'assigned',  label: 'Ready' },
  { value: 'done',      label: 'Done' },
]

const stateVariants: Record<string, 'secondary' | 'warning' | 'success' | 'default' | 'destructive'> = {
  draft:     'secondary',
  waiting:   'warning',
  confirmed: 'warning',
  assigned:  'success',
  done:      'default',
  cancel:    'destructive',
}

const moveStateLabels: Record<string, string> = {
  draft:     'Draft',
  waiting:   'Waiting',
  confirmed: 'Confirmed',
  assigned:  'Ready',
  done:      'Done',
  cancel:    'Cancelled',
}

function formatQty(qty: number): string {
  return qty % 1 === 0 ? String(qty) : qty.toFixed(2)
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 text-sm border-b border-border/50 last:border-0">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{children}</span>
    </div>
  )
}

export default function TransferDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isNew = id === 'new'

  const [formType, setFormType] = useState('')
  const [formSrcLoc, setFormSrcLoc] = useState('')
  const [formDestLoc, setFormDestLoc] = useState('')

  const createMut = useMutation({
    mutationFn: (vals: Record<string, any>) =>
      erpClient.raw.post('/inventory/transfers/create', vals).then((r) => r.data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['transfer'] })
      navigate(`/inventory/transfers/${result.id}`, { replace: true })
    },
  })

  const { data: picking, isLoading } = useQuery({
    queryKey: ['transfer', id],
    queryFn: () => erpClient.raw.get(`/inventory/transfers/${id}`).then((r) => r.data),
    enabled: !isNew,
  })

  const confirmMut = useMutation({
    mutationFn: () => erpClient.raw.post(`/inventory/transfers/${id}/confirm`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['transfer', id] }),
  })
  const assignMut = useMutation({
    mutationFn: () => erpClient.raw.post(`/inventory/transfers/${id}/assign`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['transfer', id] }),
  })
  const validateMut = useMutation({
    mutationFn: () => erpClient.raw.post(`/inventory/transfers/${id}/validate`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['transfer', id] }),
  })
  const unreserveMut = useMutation({
    mutationFn: () => erpClient.raw.post(`/inventory/transfers/${id}/unreserve`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['transfer', id] }),
  })
  const cancelMut = useMutation({
    mutationFn: () => erpClient.raw.post(`/inventory/transfers/${id}/cancel`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['transfer', id] }),
  })

  // ── Create mode ──
  if (isNew) {
    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">Inventory</p>
          <h1 className="text-2xl font-bold tracking-tight">New Transfer</h1>
        </div>
        <div className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-[0_20px_80px_-48px_rgba(15,23,42,0.45)]">
          <div className="border-b border-border/70 bg-muted/20 px-6 py-4">
            <CardTitle>Transfer Details</CardTitle>
          </div>
          <div className="p-6 space-y-4 max-w-lg">
            <div className="space-y-1.5">
              <Label htmlFor="tr-type">Transfer Type</Label>
              <Input
                id="tr-type"
                placeholder="e.g. Receipts, Delivery Orders"
                value={formType}
                onChange={(e) => setFormType(e.target.value)}
                className="rounded-2xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tr-src">Source Location</Label>
              <Input
                id="tr-src"
                placeholder="e.g. WH/Stock"
                value={formSrcLoc}
                onChange={(e) => setFormSrcLoc(e.target.value)}
                className="rounded-2xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tr-dest">Destination Location</Label>
              <Input
                id="tr-dest"
                placeholder="e.g. Customers"
                value={formDestLoc}
                onChange={(e) => setFormDestLoc(e.target.value)}
                className="rounded-2xl"
              />
            </div>
          </div>
          <div className="border-t border-border/60 bg-muted/20 px-6 py-4 flex gap-2">
            <Button
              onClick={() => createMut.mutate({ picking_type_name: formType, location_src: formSrcLoc, location_dest: formDestLoc })}
              disabled={createMut.isPending || !formType}
              className="rounded-2xl"
            >
              {createMut.isPending ? 'Creating…' : 'Create Transfer'}
            </Button>
            <Button variant="outline" className="rounded-2xl" onClick={() => navigate('/inventory/transfers')}>
              Cancel
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-96 w-full rounded-3xl" />
      </div>
    )
  }

  if (!picking) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-lg font-semibold">Transfer not found.</p>
        <Button variant="outline" className="mt-4 rounded-2xl" onClick={() => navigate('/inventory/transfers')}>
          <ArrowLeft className="h-4 w-4" /> Back to Transfers
        </Button>
      </div>
    )
  }

  const isDraft     = picking.state === 'draft'
  const isWaiting   = picking.state === 'confirmed' || picking.state === 'waiting'
  const isReady     = picking.state === 'assigned'
  const isDone      = picking.state === 'done'
  const isCancelled = picking.state === 'cancel'
  const moves       = picking.moves || []

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
            {picking.picking_type_id ? picking.picking_type_id[1] : 'Transfer'}
          </p>
          <h1 className="text-2xl font-bold tracking-tight">{picking.name || 'New Transfer'}</h1>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Badge variant={stateVariants[picking.state] ?? 'secondary'}>
              {picking.state === 'assigned' ? 'Ready' : picking.state === 'confirmed' || picking.state === 'waiting' ? 'Waiting' : picking.state.charAt(0).toUpperCase() + picking.state.slice(1)}
            </Badge>
            {picking.priority === '1' && (
              <Badge variant="warning">
                <AlertCircle className="mr-1 h-3 w-3" />
                Urgent
              </Badge>
            )}
            {picking.backorder_id && (
              <Badge variant="secondary">
                Backorder of {picking.backorder_id[1]}
              </Badge>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {isDraft && (
            <Button className="rounded-2xl" onClick={() => confirmMut.mutate()} disabled={confirmMut.isPending}>
              <Check className="h-4 w-4" />
              {confirmMut.isPending ? 'Confirming…' : 'Confirm'}
            </Button>
          )}
          {(isWaiting || isReady) && (
            <Button variant="outline" className="rounded-2xl" onClick={() => assignMut.mutate()} disabled={assignMut.isPending}>
              <ClipboardCheck className="h-4 w-4" />
              Check Availability
            </Button>
          )}
          {isReady && (
            <Button variant="success" className="rounded-2xl" onClick={() => validateMut.mutate()} disabled={validateMut.isPending}>
              <PackageCheck className="h-4 w-4" />
              {validateMut.isPending ? 'Validating…' : 'Validate'}
            </Button>
          )}
          {isReady && (
            <Button variant="outline" className="rounded-2xl" onClick={() => unreserveMut.mutate()} disabled={unreserveMut.isPending}>
              <Undo2 className="h-4 w-4" />
              Unreserve
            </Button>
          )}
          {!isDone && !isCancelled && (
            <Button variant="outline" className="rounded-2xl" onClick={() => cancelMut.mutate()} disabled={cancelMut.isPending}>
              <Ban className="h-4 w-4" />
              Cancel
            </Button>
          )}
          <Button variant="outline" className="rounded-2xl" onClick={() => navigate('/inventory/transfers')}>
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </div>
      </div>

      {/* Status progression bar */}
      <div className="overflow-hidden rounded-3xl border border-border/60 bg-card px-6 py-5 shadow-[0_20px_80px_-48px_rgba(15,23,42,0.45)]">
        <StatusBar
          states={pickingStates}
          currentState={picking.state === 'waiting' ? 'confirmed' : picking.state}
        />
      </div>

      {/* Detail cards — two column */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Details card */}
        <div className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-[0_20px_80px_-48px_rgba(15,23,42,0.45)]">
          <div className="border-b border-border/70 bg-muted/20 px-6 py-4">
            <p className="text-sm font-semibold">Transfer Details</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Routing, contacts, and schedule</p>
          </div>
          <div className="px-6 py-2">
            {picking.partner_id && (
              <InfoRow label="Contact">
                <span className="flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                  {picking.partner_id[1]}
                </span>
              </InfoRow>
            )}

            {/* Route visualization */}
            <div className="py-4 border-b border-border/50">
              <p className="text-xs text-muted-foreground mb-3">Route</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 rounded-xl border border-border/60 bg-muted/40 px-3 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">From</p>
                  <div className="flex items-center gap-1.5 text-sm font-medium">
                    <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate">{picking.location_id ? picking.location_id[1] : '—'}</span>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="flex-1 rounded-xl border border-border/60 bg-muted/40 px-3 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">To</p>
                  <div className="flex items-center gap-1.5 text-sm font-medium">
                    <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate">{picking.location_dest_id ? picking.location_dest_id[1] : '—'}</span>
                  </div>
                </div>
              </div>
            </div>

            <InfoRow label="Scheduled">
              <span className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                {picking.scheduled_date ? picking.scheduled_date.split(' ')[0] : '—'}
              </span>
            </InfoRow>
            {picking.date_done && (
              <InfoRow label="Completed">
                {picking.date_done.split(' ')[0]}
              </InfoRow>
            )}
            {picking.origin && (
              <InfoRow label="Source Document">
                <span className="flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                  {picking.origin}
                </span>
              </InfoRow>
            )}
          </div>
        </div>

        {/* Operation card */}
        <div className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-[0_20px_80px_-48px_rgba(15,23,42,0.45)]">
          <div className="border-b border-border/70 bg-muted/20 px-6 py-4">
            <p className="text-sm font-semibold">Operation</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Type, policy, and assignment</p>
          </div>
          <div className="px-6 py-2">
            <InfoRow label="Operation Type">
              <span className="flex items-center gap-1.5">
                <Truck className="h-3.5 w-3.5 text-muted-foreground" />
                {picking.picking_type_id ? picking.picking_type_id[1] : '—'}
              </span>
            </InfoRow>
            <InfoRow label="Shipping Policy">
              {picking.move_type === 'one' ? 'When all products ready' : 'As soon as possible'}
            </InfoRow>
            <InfoRow label="Responsible">
              <span className="flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
                {picking.user_id ? picking.user_id[1] : '—'}
              </span>
            </InfoRow>
          </div>
        </div>
      </div>

      {/* Products / stock moves table */}
      <div className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-[0_20px_80px_-48px_rgba(15,23,42,0.45)]">
        <div className="border-b border-border/70 bg-muted/20 px-6 py-4">
          <p className="text-sm font-semibold">Products</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {moves.length === 0 ? 'No products in this transfer' : `${moves.length} product line${moves.length === 1 ? '' : 's'}`}
          </p>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Demand</TableHead>
              <TableHead className="text-right">Done</TableHead>
              <TableHead>UoM</TableHead>
              <TableHead>From</TableHead>
              <TableHead>To</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {moves.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  No products in this transfer.
                </TableCell>
              </TableRow>
            ) : (
              moves.map((move: any) => (
                <TableRow key={move.id} className="hover:bg-muted/50">
                  <TableCell className="font-medium">
                    {move.product_id ? move.product_id[1] : '—'}
                  </TableCell>
                  <TableCell className="max-w-[160px] truncate text-xs text-muted-foreground">
                    {move.name || '—'}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {formatQty(move.product_uom_qty)}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    <span className={cn(
                      'font-semibold',
                      move.quantity >= move.product_uom_qty && move.quantity > 0
                        ? 'text-success'
                        : move.quantity > 0
                          ? 'text-warning'
                          : '',
                    )}>
                      {formatQty(move.quantity)}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {move.product_uom_id ? move.product_uom_id[1] : '—'}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {move.location_id ? move.location_id[1] : '—'}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {move.location_dest_id ? move.location_dest_id[1] : '—'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={stateVariants[move.state] ?? 'secondary'} className="text-xs">
                      {moveStateLabels[move.state] ?? move.state}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
