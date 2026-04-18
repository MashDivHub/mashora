import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Badge, Button, Card, CardContent, Input, Label, Textarea, cn } from '@mashora/design-system'
import { Key, Search, Plus, Trash2, X } from 'lucide-react'
import { PageHeader, toast, LoadingState } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'
import { extractErrorMessage } from '@/lib/errors'

interface RuleRecord {
  id: number
  name: string
  model_id: [number, string] | number | null
  domain_force: string | null
  active: boolean
  global: boolean
  perm_read: boolean
  perm_write: boolean
  perm_create: boolean
  perm_unlink: boolean
}

function m2oName(val: [number, string] | number | null | undefined): string {
  if (Array.isArray(val)) return val[1]
  return ''
}

const selectCls = 'h-10 rounded-lg border border-input bg-background px-3 text-sm'

export default function RecordRules() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newModelId, setNewModelId] = useState<number | ''>('')
  const [newDomain, setNewDomain] = useState('[]')
  const [newGlobal, setNewGlobal] = useState(true)

  const { data, isLoading } = useQuery({
    queryKey: ['permission-rules', search],
    queryFn: async () => {
      const params: Record<string, any> = {}
      if (search) params.search = search
      const { data } = await erpClient.raw.get('/permissions/rules', { params })
      return data as { records: RuleRecord[] }
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

  const toggleMut = useMutation({
    mutationFn: async ({ id, field, value }: { id: number; field: string; value: boolean }) => {
      await erpClient.raw.put(`/permissions/rules/${id}`, { [field]: value })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['permission-rules'] }),
    onError: () => toast.error('Failed to update'),
  })

  const createMut = useMutation({
    mutationFn: async () => {
      await erpClient.raw.post('/permissions/rules', {
        name: newName.trim(),
        model_id: Number(newModelId),
        domain_force: newDomain.trim() || '[]',
        global_rule: newGlobal,
      })
    },
    onSuccess: () => {
      toast.success('Record rule created')
      setNewName(''); setNewModelId(''); setNewDomain('[]'); setNewGlobal(true); setShowCreate(false)
      qc.invalidateQueries({ queryKey: ['permission-rules'] })
    },
    onError: (e: unknown) => toast.error(extractErrorMessage(e, 'Create failed')),
  })

  const deleteMut = useMutation({
    mutationFn: async (id: number) => { await erpClient.raw.delete(`/permissions/rules/${id}`) },
    onSuccess: () => { toast.success('Rule deleted'); qc.invalidateQueries({ queryKey: ['permission-rules'] }) },
    onError: (e: unknown) => toast.error(extractErrorMessage(e, 'Delete failed')),
  })

  const records = data?.records || []
  const models = modelsData?.records || []

  return (
    <div className="space-y-4">
      <PageHeader title="Record Rules" subtitle="settings" backTo="/admin/settings" />

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search rules..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Button className="rounded-xl" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-1.5" /> New Rule
        </Button>
      </div>

      {showCreate && (
        <Card className="rounded-2xl border-primary/30 shadow-lg">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">New Record Rule</h3>
              <button onClick={() => setShowCreate(false)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Rule Name</Label>
                <Input placeholder="e.g. Own Documents Only" value={newName} onChange={e => setNewName(e.target.value)} autoFocus />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Model</Label>
                <select value={newModelId} onChange={e => setNewModelId(Number(e.target.value))} className={cn(selectCls, 'w-full')}>
                  <option value="">Select model...</option>
                  {models.map(m => <option key={m.id} value={m.id}>{m.model}</option>)}
                </select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs">Domain Filter (Python expression)</Label>
                <Textarea value={newDomain} onChange={e => setNewDomain(e.target.value)} rows={3} placeholder="[('user_id', '=', user.id)]" className="font-mono text-xs" />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={newGlobal} onChange={e => setNewGlobal(e.target.checked)} className="rounded" />
                Global rule (applies to all users)
              </label>
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
                <th className="text-left px-4 py-3 font-medium">Domain</th>
                <th className="text-center px-3 py-3 font-medium">Scope</th>
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
                <tr><td colSpan={10} className="px-4 py-8 text-center"><LoadingState label="Loading record rules..." /></td></tr>
              ) : records.length === 0 ? (
                <tr><td colSpan={10} className="px-4 py-8 text-center text-muted-foreground">No record rules found</td></tr>
              ) : (
                records.map(rule => (
                  <tr key={rule.id} className="border-b last:border-0 hover:bg-muted/10 transition-colors group">
                    <td className="px-4 py-2.5 font-medium text-xs">{rule.name}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{m2oName(rule.model_id)}</td>
                    <td className="px-4 py-2.5 max-w-[200px]">
                      {rule.domain_force ? (
                        <code className="text-[10px] bg-muted px-2 py-0.5 rounded block truncate font-mono" title={rule.domain_force}>{rule.domain_force}</code>
                      ) : <span className="text-[10px] text-muted-foreground">-</span>}
                    </td>
                    <td className="text-center px-3 py-2.5">
                      <Badge variant={rule.global ? 'default' : 'secondary'} className="rounded-full text-[10px]">{rule.global ? 'Global' : 'Group'}</Badge>
                    </td>
                    {(['perm_read', 'perm_write', 'perm_create', 'perm_unlink'] as const).map(f => (
                      <td key={f} className="text-center px-3 py-2.5">
                        <button onClick={() => toggleMut.mutate({ id: rule.id, field: f, value: !rule[f] })} className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold transition-colors ${rule[f] ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-muted text-muted-foreground'}`}>
                          {rule[f] ? '\u2713' : '\u2715'}
                        </button>
                      </td>
                    ))}
                    <td className="text-center px-3 py-2.5">
                      <button onClick={() => toggleMut.mutate({ id: rule.id, field: 'active', value: !rule.active })} className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold transition-colors ${rule.active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-muted text-muted-foreground'}`}>
                        {rule.active ? '\u2713' : '\u2715'}
                      </button>
                    </td>
                    <td className="px-2 py-2.5">
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive" onClick={() => { if (confirm(`Delete rule "${rule.name}"?`)) deleteMut.mutate(rule.id) }}>
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
      <p className="text-xs text-muted-foreground">{records.length} record rules</p>
    </div>
  )
}
