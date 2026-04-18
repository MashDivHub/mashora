import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Badge, Button, Input, Skeleton, Switch } from '@mashora/design-system'
import { CheckCircle2, GitBranch, Plus, Pencil, Trash2, Check, X } from 'lucide-react'
import { PageHeader, ConfirmDialog, toast } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'
import { extractErrorMessage } from '@/lib/errors'

interface Stage {
  id: number
  name: string
  is_won: boolean
  sequence: number
  fold: boolean
  team_ids?: number[]
}

interface StagesResponse {
  records: Stage[]
  total: number
}

interface StageForm {
  name: string
  sequence: number
  is_won: boolean
  fold: boolean
}

const blankForm = (seq: number): StageForm => ({
  name: '',
  sequence: seq,
  is_won: false,
  fold: false,
})

export default function StageList() {
  const queryClient = useQueryClient()
  const [creating, setCreating] = useState(false)
  const [createForm, setCreateForm] = useState<StageForm>(blankForm(10))
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<StageForm>(blankForm(10))
  const [busy, setBusy] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)

  const { data, isLoading } = useQuery<StagesResponse>({
    queryKey: ['crm-stages'],
    queryFn: async () => {
      const { data } = await erpClient.raw.post('/crm/stages', {})
      return data
    },
  })

  const stages = [...(data?.records ?? [])].sort((a, b) => a.sequence - b.sequence)
  const total = data?.total ?? 0
  const nextSeq = (stages.length > 0 ? Math.max(...stages.map(s => s.sequence)) : 0) + 10

  useEffect(() => {
    if (creating) setCreateForm(blankForm(nextSeq))
  }, [creating, nextSeq])

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ['crm-stages'] })
  }

  async function handleCreate() {
    if (!createForm.name.trim()) { toast.error('Name is required'); return }
    setBusy(true)
    try {
      await erpClient.raw.post('/model/crm.stage/create', {
        vals: {
          name: createForm.name.trim(),
          sequence: createForm.sequence,
          is_won: createForm.is_won,
          fold: createForm.fold,
        },
      })
      toast.success('Stage created')
      setCreating(false)
      refresh()
    } catch (e: unknown) {
      toast.error('Create failed', extractErrorMessage(e))
    } finally { setBusy(false) }
  }

  function startEdit(s: Stage) {
    setEditingId(s.id)
    setEditForm({ name: s.name, sequence: s.sequence, is_won: s.is_won, fold: s.fold })
  }

  async function handleSave(id: number) {
    if (!editForm.name.trim()) { toast.error('Name is required'); return }
    setBusy(true)
    try {
      await erpClient.raw.put(`/model/crm.stage/${id}`, {
        vals: {
          name: editForm.name.trim(),
          sequence: editForm.sequence,
          is_won: editForm.is_won,
          fold: editForm.fold,
        },
      })
      toast.success('Stage updated')
      setEditingId(null)
      refresh()
    } catch (e: unknown) {
      toast.error('Update failed', extractErrorMessage(e))
    } finally { setBusy(false) }
  }

  async function handleDelete() {
    if (!deleteId) return
    setBusy(true)
    try {
      await erpClient.raw.delete(`/model/crm.stage/${deleteId}`)
      toast.success('Stage deleted')
      setDeleteId(null)
      refresh()
    } catch (e: unknown) {
      toast.error('Delete failed', extractErrorMessage(e))
    } finally { setBusy(false) }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Pipeline Stages"
        subtitle={isLoading ? 'Loading…' : `${total} stage${total !== 1 ? 's' : ''}`}
        actions={
          <Button size="sm" className="rounded-xl gap-1.5" onClick={() => setCreating(v => !v)}>
            <Plus className="h-3.5 w-3.5" /> New Stage
          </Button>
        }
      />

      {creating && (
        <div className="rounded-2xl border border-primary/40 bg-card/60 p-4 space-y-3">
          <div className="grid md:grid-cols-[2fr_80px_1fr_1fr_auto] gap-3 items-end">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-1">Name</p>
              <Input value={createForm.name} onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Stage name..." className="rounded-xl h-9" autoFocus />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-1">Seq</p>
              <Input type="number" value={createForm.sequence}
                onChange={e => setCreateForm(f => ({ ...f, sequence: Number(e.target.value) }))}
                className="rounded-xl h-9 font-mono" />
            </div>
            <div className="flex items-center gap-2 h-9">
              <Switch checked={createForm.is_won} onCheckedChange={v => setCreateForm(f => ({ ...f, is_won: v }))} />
              <span className="text-xs">Won Stage</span>
            </div>
            <div className="flex items-center gap-2 h-9">
              <Switch checked={createForm.fold} onCheckedChange={v => setCreateForm(f => ({ ...f, fold: v }))} />
              <span className="text-xs">Folded</span>
            </div>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="ghost" className="h-9 w-9 p-0 rounded-lg" onClick={() => setCreating(false)} disabled={busy}>
                <X className="h-4 w-4" />
              </Button>
              <Button size="sm" className="h-9 rounded-lg gap-1.5" onClick={handleCreate} disabled={busy}>
                <Check className="h-4 w-4" /> Add
              </Button>
            </div>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
      )}

      {!isLoading && stages.length === 0 && !creating && (
        <div className="rounded-2xl border border-border/30 bg-card/50 p-6 flex flex-col items-center justify-center gap-2 py-12">
          <GitBranch className="h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No pipeline stages configured</p>
        </div>
      )}

      {!isLoading && stages.length > 0 && (
        <div className="flex flex-col">
          {stages.map((stage, idx) => {
            const isEditing = editingId === stage.id
            return (
              <div key={stage.id} className="flex flex-col items-stretch">
                <div className="rounded-2xl border border-border/30 bg-card/50 p-4 group">
                  {isEditing ? (
                    <div className="grid md:grid-cols-[2fr_80px_1fr_1fr_auto] gap-3 items-end">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-1">Name</p>
                        <Input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                          className="rounded-xl h-9" autoFocus />
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-1">Seq</p>
                        <Input type="number" value={editForm.sequence}
                          onChange={e => setEditForm(f => ({ ...f, sequence: Number(e.target.value) }))}
                          className="rounded-xl h-9 font-mono" />
                      </div>
                      <div className="flex items-center gap-2 h-9">
                        <Switch checked={editForm.is_won} onCheckedChange={v => setEditForm(f => ({ ...f, is_won: v }))} />
                        <span className="text-xs">Won Stage</span>
                      </div>
                      <div className="flex items-center gap-2 h-9">
                        <Switch checked={editForm.fold} onCheckedChange={v => setEditForm(f => ({ ...f, fold: v }))} />
                        <span className="text-xs">Folded</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button size="sm" variant="ghost" className="h-9 w-9 p-0 rounded-lg" onClick={() => setEditingId(null)} disabled={busy}>
                          <X className="h-4 w-4" />
                        </Button>
                        <Button size="sm" className="h-9 rounded-lg gap-1.5" onClick={() => handleSave(stage.id)} disabled={busy}>
                          <Check className="h-4 w-4" /> Save
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-3">
                      {/* Left: sequence + name */}
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-xs font-mono text-muted-foreground/60 w-6 text-right shrink-0">
                          {stage.sequence}
                        </span>
                        <span className="text-sm font-bold truncate">{stage.name}</span>
                        {stage.is_won && (
                          <Badge className="rounded-full bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-xs flex items-center gap-1 shrink-0">
                            <CheckCircle2 className="h-3 w-3" />
                            Won
                          </Badge>
                        )}
                        {stage.fold && (
                          <span className="text-xs text-muted-foreground/60 shrink-0">Folded</span>
                        )}
                      </div>

                      {/* Right: team + actions */}
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-muted-foreground">
                          {stage.team_ids && stage.team_ids.length > 0 ? `${stage.team_ids.length} team${stage.team_ids.length !== 1 ? 's' : ''}` : 'All Teams'}
                        </span>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0 rounded-lg" onClick={() => startEdit(stage)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0 rounded-lg text-destructive"
                            onClick={() => setDeleteId(stage.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Pipeline connector between cards */}
                {idx < stages.length - 1 && (
                  <div className="flex justify-center">
                    <div className="w-px h-3 bg-border/40" />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <ConfirmDialog
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete stage?"
        message="This stage will be removed. Leads in this stage may need to be reassigned."
        variant="danger"
        confirmLabel="Delete"
        loading={busy}
      />
    </div>
  )
}
