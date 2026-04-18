import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Input, Skeleton, Switch } from '@mashora/design-system'
import { XCircle, Plus, Pencil, Trash2, Check, X } from 'lucide-react'
import { PageHeader, ConfirmDialog, toast } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'
import { extractErrorMessage } from '@/lib/errors'

interface LostReason {
  id: number
  name: string
  active: boolean
}

interface LostReasonsResponse {
  records: LostReason[]
  total: number
}

export default function LostReasons() {
  const queryClient = useQueryClient()
  const [creating, setCreating] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createActive, setCreateActive] = useState(true)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [editActive, setEditActive] = useState(true)
  const [busy, setBusy] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)

  const { data, isLoading } = useQuery<LostReasonsResponse>({
    queryKey: ['crm-lost-reasons'],
    queryFn: async () => {
      // Use generic model endpoint so we get the `active` field too.
      const { data } = await erpClient.raw.post('/model/crm.lost.reason', {
        domain: [],
        fields: ['id', 'name', 'active'],
        order: 'name asc',
        limit: 200,
      })
      return data
    },
  })

  const reasons = data?.records ?? []
  const total = data?.total ?? 0

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ['crm-lost-reasons'] })
    queryClient.invalidateQueries({ queryKey: ['crm-lost-reasons-list'] })
  }

  async function handleCreate() {
    if (!createName.trim()) { toast.error('Name is required'); return }
    setBusy(true)
    try {
      await erpClient.raw.post('/model/crm.lost.reason/create', {
        vals: { name: createName.trim(), active: createActive },
      })
      toast.success('Lost reason created')
      setCreating(false)
      setCreateName('')
      setCreateActive(true)
      refresh()
    } catch (e: unknown) {
      toast.error('Create failed', extractErrorMessage(e))
    } finally { setBusy(false) }
  }

  function startEdit(r: LostReason) {
    setEditingId(r.id)
    setEditName(r.name)
    setEditActive(r.active ?? true)
  }

  async function handleSave(id: number) {
    if (!editName.trim()) { toast.error('Name is required'); return }
    setBusy(true)
    try {
      await erpClient.raw.put(`/model/crm.lost.reason/${id}`, {
        vals: { name: editName.trim(), active: editActive },
      })
      toast.success('Lost reason updated')
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
      await erpClient.raw.delete(`/model/crm.lost.reason/${deleteId}`)
      toast.success('Lost reason deleted')
      setDeleteId(null)
      refresh()
    } catch (e: unknown) {
      toast.error('Delete failed', extractErrorMessage(e))
    } finally { setBusy(false) }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Lost Reasons"
        subtitle={isLoading ? 'Loading…' : `${total} reason${total !== 1 ? 's' : ''}`}
        actions={
          <Button size="sm" className="rounded-xl gap-1.5" onClick={() => setCreating(v => !v)}>
            <Plus className="h-3.5 w-3.5" /> New Reason
          </Button>
        }
      />

      {creating && (
        <div className="rounded-2xl border border-primary/40 bg-card/60 p-4">
          <div className="flex items-center gap-3">
            <XCircle className="h-4 w-4 text-muted-foreground/50 shrink-0" />
            <Input value={createName} onChange={e => setCreateName(e.target.value)}
              placeholder="Reason name..." aria-label="New lost reason name" className="rounded-xl h-9 flex-1" autoFocus
              disabled={busy}
              onKeyDown={e => { if (e.key === 'Enter' && !busy) handleCreate() }} />
            <div className="flex items-center gap-2">
              <Switch checked={createActive} onCheckedChange={setCreateActive} />
              <span className="text-xs">Active</span>
            </div>
            <Button size="sm" variant="ghost" className="h-9 w-9 p-0 rounded-lg" onClick={() => setCreating(false)} disabled={busy}>
              <X className="h-4 w-4" />
            </Button>
            <Button size="sm" className="h-9 rounded-lg gap-1.5" onClick={handleCreate} disabled={busy}>
              <Check className="h-4 w-4" /> Add
            </Button>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-2xl" />
          ))}
        </div>
      )}

      {!isLoading && reasons.length === 0 && !creating && (
        <div className="rounded-2xl border border-border/30 bg-card/50 p-6 flex flex-col items-center justify-center gap-2 py-12">
          <XCircle className="h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No lost reasons configured</p>
        </div>
      )}

      {!isLoading && reasons.length > 0 && (
        <div className="rounded-2xl border border-border/30 bg-card/50 p-2">
          {reasons.map((reason, idx) => {
            const isEditing = editingId === reason.id
            return (
              <div
                key={reason.id}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl group transition-colors hover:bg-muted/30 ${
                  idx !== reasons.length - 1 ? 'border-b border-border/20' : ''
                }`}
              >
                <XCircle className={`h-4 w-4 shrink-0 ${reason.active ? 'text-muted-foreground/50' : 'text-muted-foreground/20'}`} />
                {isEditing ? (
                  <>
                    <Input value={editName} onChange={e => setEditName(e.target.value)}
                      aria-label="Edit lost reason name"
                      className="rounded-xl h-9 flex-1" autoFocus
                      disabled={busy}
                      onKeyDown={e => { if (e.key === 'Enter' && !busy) handleSave(reason.id) }} />
                    <div className="flex items-center gap-2">
                      <Switch checked={editActive} onCheckedChange={setEditActive} />
                      <span className="text-xs">Active</span>
                    </div>
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0 rounded-lg" onClick={() => setEditingId(null)} disabled={busy}>
                      <X className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0 rounded-lg" onClick={() => handleSave(reason.id)} disabled={busy}>
                      <Check className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <span className={`text-sm flex-1 ${reason.active ? 'text-foreground' : 'text-muted-foreground line-through'}`}>{reason.name}</span>
                    {!reason.active && <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Archived</span>}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0 rounded-lg" onClick={() => startEdit(reason)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0 rounded-lg text-destructive"
                        onClick={() => setDeleteId(reason.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </>
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
        title="Delete lost reason?"
        message="This reason will be removed. Existing leads using it may lose the association."
        variant="danger"
        confirmLabel="Delete"
        loading={busy}
      />
    </div>
  )
}
