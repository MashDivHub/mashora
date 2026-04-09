import { useQuery } from '@tanstack/react-query'
import { Badge, Skeleton } from '@mashora/design-system'
import { Users } from 'lucide-react'
import { PageHeader } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'

interface MailingList {
  id: number
  name: string
  contact_count: number
  is_public: boolean
  active: boolean
  create_date: string
}

export default function MailingLists() {
  const { data, isLoading } = useQuery({
    queryKey: ['mailing-lists'],
    queryFn: async () => {
      const { data } = await erpClient.raw.post('/model/mailing.list', {
        fields: ['id', 'name', 'contact_count', 'is_public', 'active', 'create_date'],
        order: 'name asc',
        limit: 100,
      })
      return data as { records: MailingList[]; total: number }
    },
  })

  const records = data?.records ?? []
  const total   = data?.total ?? 0

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full rounded-xl" />
        <div className="grid md:grid-cols-2 gap-4">
          {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-32 rounded-2xl" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mailing Lists"
        subtitle={total > 0 ? `${total} list${total !== 1 ? 's' : ''}` : undefined}
      />

      {records.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 gap-3 text-muted-foreground">
          <Users className="h-10 w-10" />
          <p className="text-sm">No mailing lists found</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {records.map(list => (
            <div
              key={list.id}
              className="rounded-2xl border border-border/30 bg-card/50 p-5 space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-bold text-sm leading-snug">{list.name}</p>
                <Badge
                  variant={list.active ? 'success' : 'secondary'}
                  className="rounded-full text-xs shrink-0"
                >
                  {list.active ? 'Active' : 'Archived'}
                </Badge>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="rounded-full text-xs gap-1">
                  <Users className="h-3 w-3" />
                  {Number(list.contact_count ?? 0).toLocaleString()} contacts
                </Badge>
                <Badge
                  variant={list.is_public ? 'info' : 'secondary'}
                  className="rounded-full text-xs"
                >
                  {list.is_public ? 'Public' : 'Private'}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
