import { useQuery } from '@tanstack/react-query'
import { Badge, Skeleton } from '@mashora/design-system'
import { BookMarked } from 'lucide-react'
import { PageHeader } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'

interface Journal {
  id: number
  name: string
  type: 'sale' | 'purchase' | 'bank' | 'cash' | 'general'
  code: string
  company_id: [number, string]
}

const TYPE_BADGE: Record<
  Journal['type'],
  { label: string; className: string }
> = {
  sale:     { label: 'Sale',     className: 'bg-blue-500/15 text-blue-400 border-blue-500/20' },
  purchase: { label: 'Purchase', className: 'bg-amber-500/15 text-amber-400 border-amber-500/20' },
  bank:     { label: 'Bank',     className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' },
  cash:     { label: 'Cash',     className: 'bg-purple-500/15 text-purple-400 border-purple-500/20' },
  general:  { label: 'General',  className: 'bg-muted/60 text-muted-foreground border-border/40' },
}

function CardSkeleton() {
  return (
    <div className="rounded-2xl border border-border/30 bg-card/50 p-5 space-y-3">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-5 w-12 rounded-md" />
      </div>
      <Skeleton className="h-5 w-20 rounded-full" />
      <Skeleton className="h-4 w-28" />
    </div>
  )
}

export default function JournalList() {
  const { data, isLoading } = useQuery({
    queryKey: ['journals'],
    queryFn: async () => {
      const { data } = await erpClient.raw.post('/accounting/journals', {
        domain: [],
        offset: 0,
        limit: 100,
      })
      return data
    },
  })

  const records: Journal[] = data?.records ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Journals"
        subtitle="accounting"
      />

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : records.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-20 text-muted-foreground">
          <div className="rounded-2xl border border-border/70 bg-muted/40 p-4">
            <BookMarked className="h-6 w-6" />
          </div>
          <p className="text-sm">No journals found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {records.map((journal) => {
            const typeMeta = TYPE_BADGE[journal.type] ?? TYPE_BADGE.general
            const company = Array.isArray(journal.company_id)
              ? journal.company_id[1]
              : ''

            return (
              <div
                key={journal.id}
                className="rounded-2xl border border-border/30 bg-card/50 p-5 space-y-3 hover:bg-card/80 transition-colors"
              >
                {/* Name + code */}
                <div className="flex items-start justify-between gap-2">
                  <span className="font-semibold text-sm leading-snug">
                    {journal.name}
                  </span>
                  <span className="shrink-0 rounded-md border border-border/40 bg-muted/60 px-2 py-0.5 font-mono text-[11px] font-semibold text-muted-foreground">
                    {journal.code}
                  </span>
                </div>

                {/* Type badge */}
                <div>
                  <span
                    className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${typeMeta.className}`}
                  >
                    {typeMeta.label}
                  </span>
                </div>

                {/* Company */}
                {company && (
                  <p className="text-xs text-muted-foreground">{company}</p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
