import { useQuery } from '@tanstack/react-query'
import { PageHeader } from '@/components/shared'
import { Badge, Skeleton } from '@mashora/design-system'
import { erpClient } from '@/lib/erp-api'
import { Users, User, Building2 } from 'lucide-react'

const colorMap: Record<number, string> = {
  0: 'border-l-gray-500', 1: 'border-l-red-500', 2: 'border-l-orange-500',
  3: 'border-l-yellow-500', 4: 'border-l-emerald-500', 5: 'border-l-cyan-500',
  6: 'border-l-blue-500', 7: 'border-l-purple-500', 8: 'border-l-pink-500',
  9: 'border-l-rose-500', 10: 'border-l-indigo-500',
}

interface SalesTeam {
  id: number
  name: string
  user_id: [number, string]
  member_ids: number[]
  member_count: number
  company_id: [number, string]
  color: number
}

interface TeamsResponse {
  records: SalesTeam[]
  total: number
}

export default function SalesTeams() {
  const { data, isLoading } = useQuery<TeamsResponse>({
    queryKey: ['sales-teams'],
    queryFn: async () => {
      const { data } = await erpClient.raw.get('/sales/teams')
      return data
    },
  })

  const teams = data?.records ?? []
  const total = data?.total ?? 0

  return (
    <div className="space-y-4">
      <PageHeader
        title="Sales Teams"
        subtitle={isLoading ? 'Loading…' : `${total} team${total !== 1 ? 's' : ''}`}
      />

      {isLoading && (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-2xl" />
          ))}
        </div>
      )}

      {!isLoading && teams.length === 0 && (
        <p className="text-sm text-muted-foreground">No sales teams configured</p>
      )}

      {!isLoading && teams.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {teams.map(team => (
            <div
              key={team.id}
              className={`rounded-2xl border border-border/30 border-l-4 bg-card/50 p-5 ${colorMap[team.color] ?? 'border-l-gray-500'}`}
            >
              <p className="text-lg font-bold leading-tight">{team.name}</p>

              <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 shrink-0" />
                  <span>{Array.isArray(team.user_id) ? team.user_id[1] : '—'}</span>
                </div>

                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 shrink-0" />
                  <span>{Array.isArray(team.company_id) ? team.company_id[1] : '—'}</span>
                </div>

                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 shrink-0" />
                  <Badge variant="secondary" className="rounded-full text-xs">
                    {team.member_count} member{team.member_count !== 1 ? 's' : ''}
                  </Badge>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
