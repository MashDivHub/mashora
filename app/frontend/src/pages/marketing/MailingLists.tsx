import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Badge, Button, Skeleton } from '@mashora/design-system'
import { Users, Plus } from 'lucide-react'
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
  const navigate = useNavigate()
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
        onNew={() => navigate('/admin/model/mailing.list/new')}
        newLabel="New List"
      />

      {records.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/50 bg-muted/20 p-12 text-center space-y-4">
          <div className="mx-auto rounded-2xl bg-primary/10 p-3 w-fit text-primary">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-semibold">No mailing lists yet</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              Create your first mailing list to group contacts for email campaigns.
            </p>
          </div>
          <Button onClick={() => navigate('/admin/model/mailing.list/new')} className="gap-2">
            <Plus className="h-4 w-4" />
            Create First List
          </Button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {records.map(list => (
            <button
              type="button"
              key={list.id}
              onClick={() => navigate(`/admin/model/mailing.list/${list.id}`)}
              className="rounded-2xl border border-border/30 bg-card/50 p-5 space-y-3 text-left hover:bg-muted/20 hover:-translate-y-0.5 transition-all w-full"
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
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
