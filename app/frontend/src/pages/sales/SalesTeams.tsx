import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Badge, Button, Input, Label, Skeleton,
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@mashora/design-system'
import { Users, User, Building2, Plus, Pencil, Trash2, X, ChevronDown, ChevronRight, UserPlus } from 'lucide-react'
import { PageHeader, ConfirmDialog, M2OInput, toast } from '@/components/shared'
import type { M2OValue } from '@/components/shared/OrderLinesEditor'
import { erpClient } from '@/lib/erp-api'
import { extractErrorMessage } from '@/lib/errors'

const colorMap: Record<number, string> = {
  0: 'border-l-gray-500', 1: 'border-l-red-500', 2: 'border-l-orange-500',
  3: 'border-l-yellow-500', 4: 'border-l-emerald-500', 5: 'border-l-cyan-500',
  6: 'border-l-blue-500', 7: 'border-l-purple-500', 8: 'border-l-pink-500',
  9: 'border-l-rose-500', 10: 'border-l-indigo-500',
}

interface SalesTeam {
  id: number
  name: string
  user_id: [number, string] | false
  alias_id?: [number, string] | false
  member_ids: number[]
  member_count: number
  company_id: [number, string] | false
  color: number
  invoiced_target?: number
}

interface TeamsResponse {
  records: SalesTeam[]
  total: number
}

interface TeamFormState {
  name: string
  user_id: M2OValue
  alias_id: M2OValue
  invoiced_target: number
}

const blankTeam: TeamFormState = {
  name: '',
  user_id: false,
  alias_id: false,
  invoiced_target: 0,
}

// ─── Team Form Dialog ────────────────────────────────────────────────────────

function TeamFormDialog({
  open, onOpenChange, team, onSaved,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  team: SalesTeam | null
  onSaved: () => void
}) {
  const [form, setForm] = useState<TeamFormState>(blankTeam)
  const [busy, setBusy] = useState(false)
  const isEdit = !!team

  useEffect(() => {
    if (open) {
      if (team) {
        setForm({
          name: team.name || '',
          user_id: team.user_id || false,
          alias_id: team.alias_id || false,
          invoiced_target: Number(team.invoiced_target ?? 0),
        })
      } else {
        setForm(blankTeam)
      }
    }
  }, [open, team])

  async function handleSave() {
    if (!form.name.trim()) { toast.error('Name is required'); return }
    setBusy(true)
    try {
      const vals: Record<string, unknown> = {
        name: form.name.trim(),
        user_id: Array.isArray(form.user_id) ? form.user_id[0] : (form.user_id || false),
        alias_id: Array.isArray(form.alias_id) ? form.alias_id[0] : (form.alias_id || false),
        invoiced_target: form.invoiced_target || 0,
      }
      if (isEdit && team) {
        await erpClient.raw.put(`/model/crm.team/${team.id}`, { vals })
        toast.success('Team updated')
      } else {
        await erpClient.raw.post('/model/crm.team/create', { vals })
        toast.success('Team created')
      }
      onOpenChange(false)
      onSaved()
    } catch (e: unknown) {
      toast.error('Save failed', extractErrorMessage(e))
    } finally { setBusy(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Sales Team' : 'New Sales Team'}</DialogTitle>
          <DialogDescription>{isEdit ? 'Update team details.' : 'Create a new sales team.'}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="team-name">Name</Label>
            <Input id="team-name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="rounded-xl h-9" autoFocus />
          </div>
          <div className="space-y-2">
            <Label>Team Leader</Label>
            <M2OInput value={form.user_id} model="res.users" onChange={v => setForm(f => ({ ...f, user_id: v }))}
              placeholder="Select team leader..." />
          </div>
          <div className="space-y-2">
            <Label>Alias</Label>
            <M2OInput value={form.alias_id} model="mail.alias" onChange={v => setForm(f => ({ ...f, alias_id: v }))}
              placeholder="Select email alias..." />
          </div>
          <div className="space-y-2">
            <Label htmlFor="team-target">Invoicing Target</Label>
            <Input id="team-target" type="number" value={form.invoiced_target}
              onChange={e => setForm(f => ({ ...f, invoiced_target: Number(e.target.value) }))}
              className="rounded-xl h-9" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={handleSave} disabled={busy}>{busy ? 'Saving...' : (isEdit ? 'Save' : 'Create')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Members Editor ─────────────────────────────────────────────────────────

function MembersEditor({ teamId, memberIds, onChanged }: { teamId: number; memberIds: number[]; onChanged: () => void }) {
  const [picker, setPicker] = useState<M2OValue>(false)
  const [busy, setBusy] = useState(false)
  const [removing, setRemoving] = useState<number | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['team-members', teamId, memberIds.join(',')],
    queryFn: async () => {
      if (!memberIds || memberIds.length === 0) return [] as { id: number; display_name: string }[]
      const { data } = await erpClient.raw.post('/model/res.users', {
        domain: [['id', 'in', memberIds]],
        fields: ['id', 'display_name'],
        limit: 200,
      })
      return data.records || []
    },
  })

  const members = data || []

  async function addMember(v: M2OValue) {
    const newId = Array.isArray(v) ? v[0] : v
    if (!newId || memberIds.includes(newId)) { setPicker(false); return }
    setBusy(true)
    try {
      await erpClient.raw.put(`/model/crm.team/${teamId}`, {
        vals: { member_ids: [[4, newId]] },
      })
      toast.success('Member added')
      setPicker(false)
      onChanged()
    } catch (e: unknown) {
      toast.error('Add failed', extractErrorMessage(e))
    } finally { setBusy(false) }
  }

  async function removeMember(uid: number) {
    setRemoving(uid)
    try {
      await erpClient.raw.put(`/model/crm.team/${teamId}`, {
        vals: { member_ids: [[3, uid]] },
      })
      toast.success('Member removed')
      onChanged()
    } catch (e: unknown) {
      toast.error('Remove failed', extractErrorMessage(e))
    } finally { setRemoving(null) }
  }

  return (
    <div className="border-t border-border/30 mt-4 pt-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Members</p>
        <Badge variant="secondary" className="rounded-full text-xs">{members.length}</Badge>
      </div>

      {isLoading ? (
        <Skeleton className="h-8 w-full rounded-lg" />
      ) : members.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">No members yet.</p>
      ) : (
        <div className="space-y-1.5">
          {members.map((m: { id: number; display_name: string }) => (
            <div key={m.id} className="flex items-center gap-2 text-sm rounded-lg bg-background/60 border border-border/30 px-2.5 py-1.5">
              <User className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="flex-1">{m.display_name}</span>
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 rounded-lg text-destructive"
                onClick={() => removeMember(m.id)} disabled={removing === m.id || busy}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <div className="flex-1">
          <M2OInput value={picker} model="res.users" onChange={addMember} placeholder="+ Add member..."
            disabled={busy} />
        </div>
        <UserPlus className="h-4 w-4 text-muted-foreground" />
      </div>
    </div>
  )
}

// ─── Main ────────────────────────────────────────────────────────────────────

export default function SalesTeams() {
  const queryClient = useQueryClient()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<SalesTeam | null>(null)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [deleteTeam, setDeleteTeam] = useState<SalesTeam | null>(null)
  const [busy, setBusy] = useState(false)

  const { data, isLoading } = useQuery<TeamsResponse>({
    queryKey: ['sales-teams'],
    queryFn: async () => {
      // Use generic endpoint to get full fields including alias_id and invoiced_target
      const { data } = await erpClient.raw.post('/model/crm.team', {
        domain: [],
        fields: ['id', 'name', 'user_id', 'alias_id', 'member_ids', 'company_id', 'color', 'invoiced_target'],
        order: 'sequence asc, name asc',
        limit: 100,
      })
      const records = ((data.records || []) as SalesTeam[]).map((t) => ({
        ...t,
        member_count: Array.isArray(t.member_ids) ? t.member_ids.length : 0,
      }))
      return { records, total: data.total ?? records.length }
    },
  })

  const teams = data?.records ?? []
  const total = data?.total ?? 0

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ['sales-teams'] })
  }

  async function handleDelete() {
    if (!deleteTeam) return
    setBusy(true)
    try {
      await erpClient.raw.delete(`/model/crm.team/${deleteTeam.id}`)
      toast.success('Team deleted')
      setDeleteTeam(null)
      refresh()
    } catch (e: unknown) {
      toast.error('Delete failed', extractErrorMessage(e))
    } finally { setBusy(false) }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Sales Teams"
        subtitle={isLoading ? 'Loading…' : `${total} team${total !== 1 ? 's' : ''}`}
        actions={
          <Button size="sm" className="rounded-xl gap-1.5" onClick={() => { setEditing(null); setFormOpen(true) }}>
            <Plus className="h-3.5 w-3.5" /> New Team
          </Button>
        }
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
          {teams.map(team => {
            const isExpanded = expandedId === team.id
            return (
              <div
                key={team.id}
                className={`rounded-2xl border border-border/30 border-l-4 bg-card/50 p-5 group ${colorMap[team.color] ?? 'border-l-gray-500'}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <button onClick={() => setExpandedId(isExpanded ? null : team.id)}
                    className="flex items-center gap-2 text-left flex-1 min-w-0">
                    {isExpanded ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
                    <p className="text-lg font-bold leading-tight truncate">{team.name}</p>
                  </button>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0 rounded-lg"
                      onClick={() => { setEditing(team); setFormOpen(true) }}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0 rounded-lg text-destructive"
                      onClick={() => setDeleteTeam(team)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

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

                {isExpanded && (
                  <MembersEditor
                    teamId={team.id}
                    memberIds={Array.isArray(team.member_ids) ? team.member_ids : []}
                    onChanged={refresh}
                  />
                )}
              </div>
            )
          })}
        </div>
      )}

      <TeamFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        team={editing}
        onSaved={refresh}
      />

      <ConfirmDialog
        open={deleteTeam !== null}
        onClose={() => setDeleteTeam(null)}
        onConfirm={handleDelete}
        title="Delete sales team?"
        message={`Remove "${deleteTeam?.name}"? This cannot be undone.`}
        variant="danger"
        confirmLabel="Delete"
        loading={busy}
      />
    </div>
  )
}
