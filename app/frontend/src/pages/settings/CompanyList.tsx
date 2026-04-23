import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@mashora/design-system'
import { Building2, Plus } from 'lucide-react'
import { DataTable, PageHeader, SearchBar, type Column } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'

const FIELDS = ['id', 'name', 'street', 'city', 'country_id', 'email', 'phone', 'website', 'currency_id', 'vat', 'logo']

export default function CompanyList() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['companies', search],
    queryFn: async () => {
      const domain = search ? [['name', 'ilike', search]] : undefined
      const { data } = await erpClient.raw.post('/model/res.company', {
        domain, fields: FIELDS, order: 'name asc', limit: 50,
      })
      return data
    },
  })

  const columns: Column[] = [
    {
      key: 'name', label: 'Company',
      render: (_, row) => (
        <div className="flex items-center gap-3">
          {row.logo ? (
            <img src={`data:image/png;base64,${row.logo}`} alt="" className="h-8 w-8 rounded-lg object-contain shrink-0" />
          ) : (
            <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
              <Building2 className="h-4 w-4 text-blue-400" />
            </div>
          )}
          <span className="text-sm font-medium">{row.name}</span>
        </div>
      ),
    },
    { key: 'city', label: 'City' },
    { key: 'country_id', label: 'Country', format: v => Array.isArray(v) ? v[1] : '' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone' },
    { key: 'currency_id', label: 'Currency', format: v => Array.isArray(v) ? v[1] : '' },
    { key: 'vat', label: 'Tax ID' },
  ]

  const records = data?.records || []
  const showEmptyCta = !isLoading && records.length === 0 && !search

  return (
    <div className="space-y-4">
      <PageHeader
        title="Companies"
        subtitle="settings"
        backTo="/admin/settings"
        onNew={() => navigate('/admin/model/res.company/new')}
        newLabel="New Company"
      />
      <SearchBar placeholder="Search companies..." onSearch={setSearch} />
      {showEmptyCta ? (
        <div className="rounded-2xl border border-dashed border-border/50 bg-muted/20 p-12 text-center space-y-4">
          <div className="mx-auto rounded-2xl bg-primary/10 p-3 w-fit text-primary">
            <Building2 className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-semibold">No companies found</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              Add a company record for each legal entity in your organisation.
            </p>
          </div>
          <Button onClick={() => navigate('/admin/model/res.company/new')} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Company
          </Button>
        </div>
      ) : (
        <DataTable columns={columns} data={records} total={data?.total} loading={isLoading}
          rowLink={row => `/admin/model/res.company/${row.id}`}
          emptyMessage="No companies found" emptyIcon={<Building2 className="h-10 w-10" />} />
      )}
    </div>
  )
}
