import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Badge, Input, Skeleton, cn } from '@mashora/design-system'
import { Plus, Star, Calendar, User } from 'lucide-react'
import { PageHeader, SearchBar, type FilterOption } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'

const CARD_FIELDS = [
  'id', 'name', 'partner_id', 'contact_name', 'partner_name',
  'expected_revenue', 'probability', 'priority', 'stage_id',
  'user_id', 'tag_ids', 'email_from', 'phone',
  'activity_date_deadline', 'activity_state',
  'is_rotting', 'color',
]

const FILTERS: FilterOption[] = [
  { key: 'my', label: 'My Pipeline', domain: [['user_id', '!=', false]] },
  { key: 'high', label: 'High Priority', domain: [['priority', 'in', ['2', '3']]] },
  { key: 'rotting', label: 'Rotting', domain: [['is_rotting', '=', true]] },
]

interface PipelineColumn {
  stage_id: number
  stage_name: string
  count: number
  revenue: number
  records: any[]
}

export default function Pipeline() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [activeFilters, setActiveFilters] = useState<string[]>([])

  const domain: any[] = [['type', '=', 'opportunity']]
  if (search) domain.push(['name', 'ilike', search])
  for (const key of activeFilters) {
    const f = FILTERS.find(fl => fl.key === key)
    if (f) domain.push(...f.domain)
  }

  // Load stages
  const { data: stages } = useQuery({
    queryKey: ['crm-stages'],
    queryFn: async () => {
      const { data } = await erpClient.raw.post('/model/crm.stage', {
        fields: ['id', 'name', 'sequence', 'is_won', 'fold'],
        order: 'sequence asc', limit: 20,
      })
      return data.records || []
    },
    staleTime: 5 * 60 * 1000,
  })

  // Load pipeline data
  const { data: columns, isLoading } = useQuery({
    queryKey: ['crm-pipeline', domain],
    queryFn: async () => {
      if (!stages?.length) return []
      const cols: PipelineColumn[] = []
      for (const stage of stages) {
        if (stage.fold) continue
        const sd = [...domain, ['stage_id', '=', stage.id]]
        const { data } = await erpClient.raw.post('/model/crm.lead', {
          domain: sd, fields: CARD_FIELDS, limit: 30, order: 'priority desc, id desc',
        })
        cols.push({
          stage_id: stage.id, stage_name: stage.name,
          count: data.total || 0,
          revenue: (data.records || []).reduce((s: number, r: any) => s + (r.expected_revenue || 0), 0),
          records: data.records || [],
        })
      }
      return cols
    },
    enabled: !!stages?.length,
  })

  const moveMut = useMutation({
    mutationFn: async ({ id, stageId }: { id: number; stageId: number }) => {
      await erpClient.raw.put(`/model/crm.lead/${id}`, { vals: { stage_id: stageId } })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['crm-pipeline'] }),
  })

  const [qcStage, setQcStage] = useState<number | null>(null)
  const [qcName, setQcName] = useState('')
  const createMut = useMutation({
    mutationFn: async ({ name, stageId }: { name: string; stageId: number }) => {
      await erpClient.raw.post('/model/crm.lead/create', { vals: { name, stage_id: stageId, type: 'opportunity' } })
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['crm-pipeline'] }); setQcStage(null); setQcName('') },
  })

  const fmtCur = (v: number) => v >= 1e6 ? `$${(v/1e6).toFixed(1)}M` : v >= 1e3 ? `$${(v/1e3).toFixed(0)}K` : `$${v.toFixed(0)}`

  return (
    <div className="space-y-4">
      <PageHeader title="Pipeline" subtitle="CRM" onNew={() => navigate('/crm/leads/new')} />
      <SearchBar placeholder="Search opportunities..." onSearch={setSearch} filters={FILTERS} activeFilters={activeFilters}
        onFilterToggle={k => setActiveFilters(p => p.includes(k) ? p.filter(x => x !== k) : [...p, k])} />

      {isLoading ? (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="w-72 shrink-0 space-y-3">
              <Skeleton className="h-8 w-full rounded-xl" />
              <Skeleton className="h-32 w-full rounded-2xl" />
              <Skeleton className="h-28 w-full rounded-2xl" />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {(columns || []).map(col => (
            <div key={col.stage_id} className="w-72 shrink-0 flex flex-col">
              {/* Column header */}
              <div className="flex items-center justify-between mb-2 px-1">
                <div className="flex items-center gap-2 min-w-0">
                  <h3 className="text-sm font-semibold truncate">{col.stage_name}</h3>
                  <Badge variant="secondary" className="text-[10px] rounded-full px-1.5">{col.count}</Badge>
                </div>
                {col.revenue > 0 && <span className="text-xs text-muted-foreground font-mono">{fmtCur(col.revenue)}</span>}
              </div>

              {/* Cards container */}
              <div className="space-y-2 flex-1 min-h-[200px] rounded-2xl bg-muted/10 border border-border/30 p-2">
                {col.records.map(lead => {
                  const partner = lead.partner_name || (Array.isArray(lead.partner_id) ? lead.partner_id[1] : '') || lead.contact_name || ''
                  const stars = parseInt(lead.priority) || 0
                  const as = lead.activity_state

                  return (
                    <div
                      key={lead.id}
                      className={cn(
                        'rounded-xl border bg-card p-3 cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md',
                        lead.is_rotting ? 'border-amber-500/30' : 'border-border/50',
                        as === 'overdue' && 'border-l-2 border-l-red-500',
                        as === 'today' && 'border-l-2 border-l-amber-500',
                        as === 'planned' && 'border-l-2 border-l-emerald-500',
                      )}
                      onClick={() => navigate(`/crm/leads/${lead.id}`)}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="text-sm font-medium leading-tight line-clamp-2">{lead.name}</p>
                        {lead.expected_revenue > 0 && (
                          <span className="text-xs font-mono font-semibold text-emerald-400 shrink-0">{fmtCur(lead.expected_revenue)}</span>
                        )}
                      </div>
                      {partner && <p className="text-xs text-muted-foreground truncate mb-1.5">{partner}</p>}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-0.5">
                          {[0,1,2].map(i => <Star key={i} className={cn('h-3 w-3', i < stars ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/20')} />)}
                        </div>
                        <div className="flex items-center gap-1.5">
                          {lead.activity_date_deadline && (
                            <span className={cn('text-[10px] font-medium',
                              as === 'overdue' && 'text-red-400', as === 'today' && 'text-amber-400', as === 'planned' && 'text-emerald-400',
                            )}><Calendar className="h-3 w-3 inline mr-0.5" />{lead.activity_date_deadline}</span>
                          )}
                          {lead.user_id && <div className="h-5 w-5 rounded-full bg-primary/15 flex items-center justify-center"><User className="h-3 w-3 text-primary" /></div>}
                        </div>
                      </div>
                      {Array.isArray(lead.tag_ids) && lead.tag_ids.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {lead.tag_ids.slice(0, 2).map((t: any, i: number) => (
                            <Badge key={i} variant="secondary" className="text-[9px] rounded-full px-1.5 py-0">{Array.isArray(t) ? t[1] : t?.display_name || t}</Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}

                {qcStage === col.stage_id ? (
                  <div className="rounded-xl border border-primary/50 bg-card p-2 space-y-2">
                    <Input value={qcName} onChange={e => setQcName(e.target.value)} placeholder="Opportunity name..." className="h-8 rounded-lg text-sm" autoFocus
                      onKeyDown={e => { if (e.key === 'Enter' && qcName.trim()) createMut.mutate({ name: qcName.trim(), stageId: col.stage_id }); if (e.key === 'Escape') { setQcStage(null); setQcName('') } }} />
                    <div className="flex gap-1">
                      <Button size="sm" className="h-7 rounded-lg text-xs flex-1" onClick={() => qcName.trim() && createMut.mutate({ name: qcName.trim(), stageId: col.stage_id })}>Add</Button>
                      <Button variant="ghost" size="sm" className="h-7 rounded-lg text-xs" onClick={() => { setQcStage(null); setQcName('') }}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setQcStage(col.stage_id)} className="w-full rounded-xl border border-dashed border-border/40 p-2 text-xs text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors">
                    <Plus className="h-3.5 w-3.5 inline mr-1" /> Quick add
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
