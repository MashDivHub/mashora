import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Button } from '@mashora/design-system'
import { FileSpreadsheet, Plus } from 'lucide-react'
import { DataTable, PageHeader, type Column } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'

interface SpreadsheetRow {
  id: number
  name: string
  create_date?: string
  write_date?: string
}

function fmt(dateStr: unknown) {
  if (!dateStr || typeof dateStr !== 'string') return '—'
  return new Date(dateStr).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

const columns: Column<SpreadsheetRow>[] = [
  {
    key: 'name',
    label: 'Name',
    render: (_, row) => <span className="text-sm font-bold">{row.name}</span>,
  },
  {
    key: 'create_date',
    label: 'Created',
    render: (v) => <span className="text-sm text-muted-foreground">{fmt(v)}</span>,
  },
  {
    key: 'write_date',
    label: 'Last Modified',
    render: (v) => <span className="text-sm text-muted-foreground">{fmt(v)}</span>,
  },
]

export default function SpreadsheetList() {
  const navigate = useNavigate()

  const { data, isLoading } = useQuery({
    queryKey: ['spreadsheet.spreadsheet.list'],
    queryFn: async () => {
      try {
        const { data } = await erpClient.raw.post('/model/spreadsheet.spreadsheet', {
          fields: ['id', 'name', 'create_date', 'write_date'],
          order: 'write_date desc',
          limit: 100,
        })
        return data
      } catch {
        return { records: [], total: 0 }
      }
    },
  })

  const records = data?.records ?? []
  const showEmptyCta = !isLoading && records.length === 0

  return (
    <div className="space-y-4">
      <PageHeader
        title="Spreadsheets"
        onNew={() => navigate('/admin/model/documents.document/new')}
        newLabel="New Spreadsheet"
      />
      {showEmptyCta ? (
        <div className="rounded-2xl border border-dashed border-border/50 bg-muted/20 p-12 text-center space-y-4">
          <div className="mx-auto rounded-2xl bg-primary/10 p-3 w-fit text-primary">
            <FileSpreadsheet className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-semibold">No spreadsheets yet</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              Create a spreadsheet to work with live data from your ERP in a familiar grid.
            </p>
          </div>
          <Button onClick={() => navigate('/admin/model/documents.document/new')} className="gap-2">
            <Plus className="h-4 w-4" />
            New Spreadsheet
          </Button>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={records}
          total={data?.total}
          loading={isLoading}
          emptyMessage="No spreadsheets found"
          emptyIcon={<FileSpreadsheet className="h-10 w-10" />}
          onRowClick={(row) => navigate(`/admin/model/documents.document/${row.id}`)}
        />
      )}
    </div>
  )
}
