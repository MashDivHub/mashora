import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Badge } from '@mashora/design-system'
import { Tag } from 'lucide-react'
import { PageHeader, SearchBar } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'

interface CategoryRecord {
  id: number
  name: string
  parent_id: [number, string] | false
  sequence: number
  website_id: [number, string] | false
}

export default function CategoryManager() {
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['website-categories', search],
    queryFn: () =>
      erpClient.raw
        .post('/website/categories', { parent_id: false, search })
        .then((r) => r.data as { records: CategoryRecord[]; total: number }),
  })

  const records = data?.records ?? []

  return (
    <div className="space-y-4">
      <PageHeader title="Product Categories" subtitle="website" />

      <SearchBar
        placeholder="Search categories..."
        onSearch={(v) => setSearch(v)}
      />

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl border border-border/30 bg-card/50 p-4 h-24 animate-pulse bg-muted/20"
            />
          ))}
        </div>
      ) : records.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
          <Tag className="h-10 w-10 text-muted-foreground/40" />
          <span className="text-sm">No product categories found</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {records.map((cat) => (
            <div
              key={cat.id}
              className="rounded-2xl border border-border/30 bg-card/50 p-4 space-y-2"
            >
              <p className="font-semibold text-sm leading-tight">{cat.name}</p>
              <div className="flex items-center gap-2 flex-wrap">
                {cat.parent_id && (
                  <Badge variant="secondary" className="rounded-full text-xs">
                    {cat.parent_id[1]}
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground ml-auto">
                  #{cat.sequence}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
