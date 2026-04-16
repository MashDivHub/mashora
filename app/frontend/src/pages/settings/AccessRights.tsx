import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Badge, Button, Card, CardContent, Input, Label } from '@mashora/design-system'
import { Lock, Search, Plus, Trash2, X } from 'lucide-react'
import { PageHeader, toast } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'

interface AclRecord {
  id: number
  name: string
  model_id: [number, string] | number | null
  group_id: [number, string] | number | null
  perm_read: boolean
  perm_write: boolean
  perm_create: boolean
  perm_unlink: boolean
  active: boolean
}

function m2oName(val: [number, string] | number | null | undefined): string {
  if (Array.isArray(val)) return val[1]
  return ''
}

const selectCls = 'h-10 rounded-lg border border-input bg-background px-3 text-sm'

export default function AccessRights() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [groupFilter, setGroupFilter] = useState<number | ''>('')
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newModelId, setNewModelId] = useState<number | ''>('')
  const [newGroupId, setNewGroupId] = useState<number | ''>('')

  const { data: groupsData } = useQuery({
    queryKey: ['permission-groups-select'],
    queryFn: async () => {
      const { data } = await erpClient.raw.get('/permissions/groups')
      return data as { records: { id: number; name: string }[] }
    },
  })

  const { data: modelsData } = useQuery({
    queryKey: ['permission-models'],
    queryFn: async () => {
      const { data } = await erpClient.raw.get('/permissions/models')
      return data as { records: { id: number; name: string; model: string }[] }
    },
    enabled: showCreate,
  })

  const { data, isLoading } = useQuery({
    queryKey: ['permission-acl-list', search, groupFilter],
    queryFn: async () => {
      const params: Record<string, any> = {}
      if (search) params.search = search
      if (groupFilter) params.group_id = groupFilter
      const { data } = await erpClient.raw.get('/permissions/acl', { params })
      return data as { records: AclRecord[] }
    },
  })

  const toggleMut = useMutation({
    mutationFn: async ({ id, field, value }: { id: number; field: string; value: boolean }) => {
      await erpClient.raw.put(`/permissions/acl/${id}`, { [field]: value })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['permission-acl-list'] }),
    onError: () => toast.error('Failed to update'),
  })

  const createMut = useMutation({
    mutationFn: async () => {
      await erpClient.raw.post('/permissions/acl', {
        name: newName.trim(),
        model_id: Number(newModelId),
        group_id: newGroupId ? Number(newGroupId) : null,
        perm_read: true, perm_write: false, perm_create: false, perm_unlink: false,
      })
    },
    onSuccess: () => {
      toast.success('ACL rule created')
      setNewName(''); setNewModelId(''); setNewGroupId(''); setShowCreate(false)
      qc.invalidateQueries({ queryKey: ['permission-acl-list'] })
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail || 'Create failed'),
  })

  const deleteMut = useMutation({
    mutationFn: async (id: number) => { await erpClient.raw.delete(`/permissions/acl/${id}`) },
    onSuccess: () => { toast.success('ACL deleted'); qc.invalidateQueries({ queryKey: ['permission-acl-list'] }) },
    onError: (e: any) => toast.error(e?.response?.data?.detail || 'Delete failed'),
  })

  const records = data?.records || []
  const groups = groupsData?.records || []
  const models = modelsData?.records || []

  return (
    <div className="space-y-4">
      <PageHeader title="Access Rights" subtitle="settings" backTo="/admin/settings" />

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <select value={groupFilter} onChange={e => setGroupFilter(e.target.value ? Number(e.target.value) : '')} className={selectCls}>
          <option value="">All groups</option>
          {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <Button className="rounded-xl" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-1.5" /> New Rule
        </Button>
      </div>

      {showCreate && (
        <Card className="rounded-2xl border-primary/30 shadow-lg">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">New Access Rule</h3>
              <button onClick={() => setShowCreate(false)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Name</Label>
                <Input placeholder="e.g. access_sale_order_user" value={newName} onChange={e => setNewName(e.target.value)} autoFocus />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Model</Label>
                <select value={newModelId} onChange={e => setNewModelId(Number(e.target.value))} className={selectCls + ' w-full'}>
                  <option value="">Select model...</option>
                  {models.map(m => <option key={m.id} value={m.id}>{m.model} ({m.name})</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Group (optional)</Label>
                <select value={newGroupId} onChange={e => setNewGroupId(e.target.value ? Number(e.target.value) : '')} className={selectCls + ' w-full'}>
                  <option value="">Global (no group)</option>
                  {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <Button onClick={() => createMut.mutate()} disabled={!newName.trim() || !newModelId || createMut.isPending} className="rounded-xl">Create</Button>
              <Button variant="ghost" onClick={() => setShowCreate(false)} className="rounded-xl">Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="rounded-2xl">
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/20">
                <th className="text-left px-4 py-3 font-medium">Name</th>
                <th className="text-left px-4 py-3 font-medium">Model</th>
                <th className="text-left px-4 py-3 font-medium">Group</th>
                <th className="text-center px-3 py-3 font-medium">R</th>
                <th className="text-center px-3 py-3 font-medium">W</th>
                <th className="text-center px-3 py-3 font-medium">C</th>
                <th className="text-center px-3 py-3 font-medium">D</th>
                <th className="text-center px-3 py-3 font-medium">Active</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">Loading...</td></tr>
              ) : records.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">No rules found</td></tr>
              ) : (
                records.map(acl => (
                  <tr key={acl.id} className="border-b last:border-0 hover:bg-muted/10 transition-colors group">
                    <td className="px-4 py-2.5 font-medium text-xs">{acl.name}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{m2oName(acl.model_id)}</td>
                    <td className="px-4 py-2.5">
                      {m2oName(acl.group_id) ? <Badge variant="secondary" className="rounded-full text-[10px]">{m2oName(acl.group_id)}</Badge> : <span className="text-[10px] text-muted-foreground">-</span>}
                    </td>
                    {(['perm_read', 'perm_write', 'perm_create', 'perm_unlink'] as const).map(f => (
                      <td key={f} className="text-center px-3 py-2.5">
                        <button onClick={() => toggleMut.mutate({ id: acl.id, field: f, value: !acl[f] })} className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold transition-colors ${acl[f] ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-muted text-muted-foreground'}`}>
                          {acl[f] ? '\u2713' : '\u2715'}
                        </button>
                      </td>
                    ))}
                    <td className="text-center px-3 py-2.5">
                      <button onClick={() => toggleMut.mutate({ id: acl.id, field: 'active', value: !acl.active })} className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold transition-colors ${acl.active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-muted text-muted-foreground'}`}>
                        {acl.active ? '\u2713' : '\u2715'}
                      </button>
                    </td>
                    <td className="px-2 py-2.5">
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive" onClick={() => { if (confirm('Delete this ACL rule?')) deleteMut.mutate(acl.id) }}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">{records.length} access rules</p>
    </div>
  )
}
