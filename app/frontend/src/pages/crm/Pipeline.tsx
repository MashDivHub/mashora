import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Badge, Input, Skeleton, cn } from '@mashora/design-system'
import { Plus, Star, Calendar, User, AlertCircle, CheckCircle2, GitBranch, ArrowRight } from 'lucide-react'
import { PageHeader, SearchBar, toast, type FilterOption } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'
import { extractErrorMessage } from '@/lib/errors'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

const FILTERS: FilterOption[] = [
  { key: 'my', label: 'My Pipeline', domain: [['user_id', '!=', false]] },
  { key: 'high', label: 'High Priority', domain: [['priority', 'in', ['2', '3']]] },
  { key: 'rotting', label: 'Rotting', domain: [['is_rotting', '=', true]] },
]

interface PipelineLead {
  id: number
  name: string
  partner_id?: [number, string] | false
  partner_name?: string
  contact_name?: string
  expected_revenue?: number
  probability?: number
  priority?: string
  stage_id?: [number, string] | false
  user_id?: [number, string] | false
  tag_ids?: Array<[number, string] | { id?: number; display_name?: string } | number>

  email_from?: string
  phone?: string
  activity_date_deadline?: string
  activity_state?: string
  is_rotting?: boolean
  color?: number
}

interface PipelineColumn {
  stage_id: number
  stage_name: string
  count: number
  revenue: number
  records: PipelineLead[]
}

interface PipelineApiEntry {
  stage: { id: number; name: string; fold?: boolean }
  leads: PipelineLead[]
  count: number
  total_revenue: number
}

export default function Pipeline() {
  useDocumentTitle('Pipeline')
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [activeFilters, setActiveFilters] = useState<string[]>([])

  // Single backend call returns the full pipeline structure (avoids N+1).
  const pipelineQueryKey = ['crm-pipeline'] as const
  const { data: rawPipeline, isLoading } = useQuery({
    queryKey: pipelineQueryKey,
    queryFn: async () => {
      const { data } = await erpClient.raw.get('/crm/pipeline')
      return (data?.pipeline ?? []) as PipelineApiEntry[]
    },
  })

  // Local optimistic state mirrors the server pipeline; reset when server data changes.
  const [localCols, setLocalCols] = useState<PipelineColumn[] | null>(null)
  const [draggingId, setDraggingId] = useState<number | null>(null)
  const [dragOverStage, setDragOverStage] = useState<number | null>(null)

  // Build columns from server data, then apply search / filter predicates client-side.
  const baseCols: PipelineColumn[] = useMemo(() => {
    if (!rawPipeline) return []
    return rawPipeline
      .filter(entry => !entry.stage?.fold)
      .map(entry => ({
        stage_id: entry.stage.id,
        stage_name: entry.stage.name,
        count: entry.count,
        revenue: entry.total_revenue,
        records: entry.leads || [],
      }))
  }, [rawPipeline])

  // Reset local state whenever the server pipeline changes.
  useEffect(() => {
    setLocalCols(baseCols)
  }, [baseCols])

  const filteredCols = useMemo(() => {
    const cols = localCols ?? baseCols
    const needle = search.trim().toLowerCase()
    const wantHigh = activeFilters.includes('high')
    const wantRotting = activeFilters.includes('rotting')
    const wantMy = activeFilters.includes('my')
    return cols.map(col => {
      const records = col.records.filter(lead => {
        if (needle && !(lead.name || '').toLowerCase().includes(needle)) return false
        if (wantHigh && !['2', '3'].includes(lead.priority || '')) return false
        if (wantRotting && !lead.is_rotting) return false
        if (wantMy && !lead.user_id) return false
        return true
      })
      const revenue = records.reduce((s, r) => s + (r.expected_revenue || 0), 0)
      return { ...col, records, count: records.length, revenue }
    })
  }, [localCols, baseCols, search, activeFilters])

  const moveMut = useMutation({
    mutationFn: async ({ id, stageId }: { id: number; stageId: number }) => {
      await erpClient.raw.put(`/model/crm.lead/${id}`, { vals: { stage_id: stageId } })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pipelineQueryKey })
    },
    // Per-call onError handles rollback because it has access to the snapshot.
  })

  const moveLead = (leadId: number, targetStageId: number) => {
    const cols = localCols ?? baseCols
    const sourceCol = cols.find(c => c.records.some(r => r.id === leadId))
    if (!sourceCol || sourceCol.stage_id === targetStageId) return

    const lead = sourceCol.records.find(r => r.id === leadId)
    if (!lead) return

    const snapshot = cols
    const next = cols.map(col => {
      if (col.stage_id === sourceCol.stage_id) {
        return { ...col, records: col.records.filter(r => r.id !== leadId) }
      }
      if (col.stage_id === targetStageId) {
        return { ...col, records: [{ ...lead, stage_id: [targetStageId, col.stage_name] as [number, string] }, ...col.records] }
      }
      return col
    })
    setLocalCols(next)
    moveMut.mutate({ id: leadId, stageId: targetStageId }, {
      onError: (err: unknown) => {
        setLocalCols(snapshot)
        toast('error', 'Move failed', extractErrorMessage(err, 'Could not move opportunity.'))
      },
    })
  }

  const [qcStage, setQcStage] = useState<number | null>(null)
  const [qcName, setQcName] = useState('')
  const createMut = useMutation({
    mutationFn: async ({ name, stageId }: { name: string; stageId: number }) => {
      await erpClient.raw.post('/model/crm.lead/create', { vals: { name, stage_id: stageId, type: 'opportunity' } })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pipelineQueryKey })
      setQcStage(null)
      setQcName('')
    },
  })

  const fmtCur = (v: number) => v >= 1e6 ? `$${(v/1e6).toFixed(1)}M` : v >= 1e3 ? `$${(v/1e3).toFixed(0)}K` : `$${v.toFixed(0)}`

  return (
    <div className="space-y-4">
      <PageHeader title="Pipeline" subtitle="CRM" onNew={() => navigate('/admin/crm/leads/new')} />
      <SearchBar
        placeholder="Search opportunities..."
        onSearch={setSearch}
        filters={FILTERS}
        activeFilters={activeFilters}
        onFilterToggle={k => setActiveFilters(p => p.includes(k) ? p.filter(x => x !== k) : [...p, k])}
      />

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
      ) : baseCols.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/50 bg-muted/20 p-12 text-center space-y-4">
          <div className="mx-auto rounded-2xl bg-primary/10 p-3 w-fit text-primary">
            <GitBranch className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-semibold">Configure your sales stages</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
              Your pipeline needs at least one stage before you can drag opportunities across it.
              Create stages like New, Qualified, Proposition, and Won to get started.
            </p>
          </div>
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <Button onClick={() => navigate('/admin/crm/stages')} className="gap-2">
              <Plus className="h-4 w-4" />
              Create Stages
            </Button>
            <Button variant="outline" onClick={() => navigate('/admin/crm/leads/new')} className="gap-2">
              New Lead
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {filteredCols.map(col => {
            const isDropTarget = dragOverStage === col.stage_id
            return (
              <div key={col.stage_id} className="w-72 shrink-0 flex flex-col">
                {/* Column header */}
                <div className="flex items-center justify-between mb-2 px-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <h3 className="text-sm font-semibold truncate">{col.stage_name}</h3>
                    <Badge variant="secondary" className="text-[10px] rounded-full px-1.5">{col.count}</Badge>
                  </div>
                  {col.revenue > 0 && <span className="text-xs text-muted-foreground font-mono">{fmtCur(col.revenue)}</span>}
                </div>

                {/* Cards container — drop target */}
                <div
                  onDragOver={(e) => {
                    e.preventDefault()
                    e.dataTransfer.dropEffect = 'move'
                    if (dragOverStage !== col.stage_id) setDragOverStage(col.stage_id)
                  }}
                  onDragLeave={(e) => {
                    // Only clear when leaving the column entirely.
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                      setDragOverStage(prev => prev === col.stage_id ? null : prev)
                    }
                  }}
                  onDrop={(e) => {
                    e.preventDefault()
                    const raw = e.dataTransfer.getData('text/plain')
                    const leadId = parseInt(raw, 10)
                    setDragOverStage(null)
                    setDraggingId(null)
                    if (!Number.isNaN(leadId)) moveLead(leadId, col.stage_id)
                  }}
                  className={cn(
                    'space-y-2 flex-1 min-h-[200px] rounded-2xl bg-muted/10 border p-2 transition-colors',
                    isDropTarget ? 'border-primary ring-2 ring-primary/40' : 'border-border/30',
                  )}
                >
                  {col.records.map(lead => {
                    const partner = lead.partner_name
                      || (Array.isArray(lead.partner_id) ? lead.partner_id[1] : '')
                      || lead.contact_name
                      || ''
                    const stars = parseInt(lead.priority || '0') || 0
                    const as = lead.activity_state
                    const isDragging = draggingId === lead.id

                    return (
                      <div
                        key={lead.id}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/plain', String(lead.id))
                          e.dataTransfer.effectAllowed = 'move'
                          setDraggingId(lead.id)
                        }}
                        onDragEnd={() => {
                          setDraggingId(null)
                          setDragOverStage(null)
                        }}
                        className={cn(
                          'rounded-xl border bg-card p-3 cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md',
                          lead.is_rotting ? 'border-amber-500/30' : 'border-border/50',
                          as === 'overdue' && 'border-l-2 border-l-red-500',
                          as === 'today' && 'border-l-2 border-l-amber-500',
                          as === 'planned' && 'border-l-2 border-l-emerald-500',
                          isDragging && 'opacity-50',
                        )}
                        onClick={() => navigate(`/admin/crm/leads/${lead.id}`)}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <p className="text-sm font-medium leading-tight line-clamp-2">{lead.name}</p>
                          {lead.expected_revenue !== undefined && lead.expected_revenue > 0 && (
                            <span className="text-xs font-mono font-semibold text-emerald-400 shrink-0">{fmtCur(lead.expected_revenue)}</span>
                          )}
                        </div>
                        {partner && <p className="text-xs text-muted-foreground truncate mb-1.5">{partner}</p>}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-0.5">
                            {[0, 1, 2].map(i => <Star key={i} className={cn('h-3 w-3', i < stars ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/20')} />)}
                          </div>
                          <div className="flex items-center gap-1.5">
                            {lead.activity_date_deadline && (() => {
                              const StateIcon = as === 'overdue' ? AlertCircle : as === 'today' ? Calendar : as === 'planned' ? CheckCircle2 : Calendar
                              return (
                                <span
                                  className={cn(
                                    'text-[10px] font-medium inline-flex items-center gap-0.5',
                                    as === 'overdue' && 'text-red-400',
                                    as === 'today' && 'text-amber-400',
                                    as === 'planned' && 'text-emerald-400',
                                  )}
                                  aria-label={as ? `${as} ${lead.activity_date_deadline}` : undefined}
                                >
                                  <StateIcon className="h-3 w-3" aria-hidden="true" />
                                  {lead.activity_date_deadline}
                                </span>
                              )
                            })()}
                            {lead.user_id && (
                              <div className="h-5 w-5 rounded-full bg-primary/15 flex items-center justify-center">
                                <User className="h-3 w-3 text-primary" />
                              </div>
                            )}
                          </div>
                        </div>
                        {Array.isArray(lead.tag_ids) && lead.tag_ids.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {lead.tag_ids.slice(0, 2).map((t, i) => (
                              <Badge key={i} variant="secondary" className="text-[9px] rounded-full px-1.5 py-0">
                                {Array.isArray(t) ? String(t[1] ?? '') : (typeof t === 'object' && t && 'display_name' in t) ? String(t.display_name ?? '') : String(t)}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}

                  {qcStage === col.stage_id ? (
                    <div className="rounded-xl border border-primary/50 bg-card p-2 space-y-2">
                      <Input
                        value={qcName}
                        onChange={e => setQcName(e.target.value)}
                        placeholder="Opportunity name..."
                        className="h-8 rounded-lg text-sm"
                        autoFocus
                        onKeyDown={e => {
                          if (e.key === 'Enter' && qcName.trim()) createMut.mutate({ name: qcName.trim(), stageId: col.stage_id })
                          if (e.key === 'Escape') { setQcStage(null); setQcName('') }
                        }}
                      />
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          className="h-7 rounded-lg text-xs flex-1"
                          onClick={() => qcName.trim() && createMut.mutate({ name: qcName.trim(), stageId: col.stage_id })}
                        >
                          Add
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 rounded-lg text-xs"
                          onClick={() => { setQcStage(null); setQcName('') }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setQcStage(col.stage_id)}
                      className="w-full rounded-xl border border-dashed border-border/40 p-2 text-xs text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5 inline mr-1" /> Quick add
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
