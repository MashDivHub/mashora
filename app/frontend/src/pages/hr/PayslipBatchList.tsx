import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { DataTable, PageHeader, SearchBar, toast } from '@/components/shared'
import type { Column } from '@/components/shared/DataTable'
import {
  Badge, Button, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, Input,
} from '@mashora/design-system'
import { erpClient } from '@/lib/erp-api'
import { extractErrorMessage } from '@/lib/errors'
import { Layers } from 'lucide-react'

interface BatchRecord {
  id: number
  name: string
  date_start: string | false
  date_end: string | false
  state: string
}

type FilterKey = 'all' | 'draft' | 'verify' | 'done'

const STATE_CONFIG: Record<string, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20' },
  verify: { label: 'To Approve', className: 'bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400' },
  done: { label: 'Done', className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400' },
}

const FILTERS = [
  { key: 'all', label: 'All', domain: [] },
  { key: 'draft', label: 'Draft', domain: [['state', '=', 'draft']] },
  { key: 'verify', label: 'To Approve', domain: [['state', '=', 'verify']] },
  { key: 'done', label: 'Done', domain: [['state', '=', 'done']] },
]

const DOMAINS: Record<FilterKey, any[]> = {
  all: [], draft: [['state', '=', 'draft']], verify: [['state', '=', 'verify']], done: [['state', '=', 'done']],
}

function fmtDate(v: string | false): string {
  if (!v) return '—'
  return v.split(' ')[0]
}

const PAGE_SIZE = 40

export default function PayslipBatchList() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [filter, setFilter] = useState<FilterKey>('all')
  const [openNew, setOpenNew] = useState(false)
  const [newForm, setNewForm] = useState({ name: '', date_start: '', date_end: '' })

  const domain = DOMAINS[filter]

  const { data, isLoading } = useQuery({
    queryKey: ['hr-payslip-batches', search, page, filter],
    queryFn: () =>
      erpClient.raw
        .post('/model/hr.payslip.run', {
          domain: search ? [...domain, ['name', 'ilike', search]] : domain,
          fields: ['id', 'name', 'date_start', 'date_end', 'state'],
          offset: page * PAGE_SIZE,
          limit: PAGE_SIZE,
          order: 'date_start desc',
        })
        .then((r) => r.data),
  })

  const records: BatchRecord[] = data?.records ?? []
  const total: number = data?.total ?? 0

  const createMut = useMutation({
    mutationFn: async () => {
      if (!newForm.name) throw new Error('Name is required')
      if (!newForm.date_start || !newForm.date_end) throw new Error('Dates are required')
      const { data } = await erpClient.raw.post('/model/hr.payslip.run/create', {
        vals: { name: newForm.name, date_start: newForm.date_start, date_end: newForm.date_end },
      })
      return data
    },
    onSuccess: (data) => {
      toast.success('Created', 'Batch created')
      setOpenNew(false)
      setNewForm({ name: '', date_start: '', date_end: '' })
      queryClient.invalidateQueries({ queryKey: ['hr-payslip-batches'] })
      if (data?.id) navigate(`/admin/hr/payslip-batches/${data.id}`)
    },
    onError: (e: unknown) => toast.error('Error', extractErrorMessage(e)),
  })

  const columns: Column<BatchRecord>[] = [
    { key: 'name', label: 'Name', render: (_v, row) => <span className="font-medium">{row.name}</span> },
    { key: 'date_start', label: 'Date From', render: (v) => fmtDate(v) },
    { key: 'date_end', label: 'Date To', render: (v) => fmtDate(v) },
    {
      key: 'state', label: 'Status', render: (v: string) => {
        const cfg = STATE_CONFIG[v] ?? STATE_CONFIG.draft
        return <Badge className={`rounded-full border text-xs font-medium ${cfg.className}`}>{cfg.label}</Badge>
      },
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payslip Batches"
        subtitle={isLoading ? 'Loading…' : `${total} batch${total !== 1 ? 'es' : ''}`}
        onNew={() => setOpenNew(true)}
      />

      <SearchBar
        placeholder="Search batches..."
        onSearch={(q) => { setSearch(q); setPage(0) }}
        filters={FILTERS}
        activeFilters={filter !== 'all' ? [filter] : []}
        onFilterToggle={(k) => { setFilter(k as FilterKey); setPage(0) }}
      />

      <DataTable<BatchRecord>
        columns={columns}
        data={records}
        total={total}
        page={page}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
        loading={isLoading}
        emptyMessage="No payslip batches found"
        emptyIcon={<Layers className="size-6" />}
        onRowClick={(row) => navigate(`/admin/hr/payslip-batches/${row.id}`)}
      />

      <Dialog open={openNew} onOpenChange={setOpenNew}>
        <DialogContent className="rounded-2xl">
          <DialogHeader><DialogTitle>New Payslip Batch</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Name</label>
              <Input value={newForm.name} onChange={(e) => setNewForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g. April 2026" className="rounded-xl h-9" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Date From</label>
                <Input type="date" value={newForm.date_start}
                  onChange={(e) => setNewForm((p) => ({ ...p, date_start: e.target.value }))}
                  className="rounded-xl h-9" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Date To</label>
                <Input type="date" value={newForm.date_end}
                  onChange={(e) => setNewForm((p) => ({ ...p, date_end: e.target.value }))}
                  className="rounded-xl h-9" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" className="rounded-xl" onClick={() => setOpenNew(false)}>Cancel</Button>
            <Button className="rounded-xl" onClick={() => createMut.mutate()} disabled={createMut.isPending}>
              {createMut.isPending ? 'Creating…' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
