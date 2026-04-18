import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { FileSpreadsheet } from 'lucide-react'
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

  return (
    <div className="space-y-4">
      <PageHeader title="Spreadsheets" />
      <DataTable
        columns={columns}
        data={data?.records ?? []}
        total={data?.total}
        loading={isLoading}
        emptyMessage="No spreadsheets found"
        emptyIcon={<FileSpreadsheet className="h-10 w-10" />}
        onRowClick={(row) => navigate(`/admin/model/documents.document/${row.id}`)}
      />
    </div>
  )
}
