import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Badge, Card, CardContent, Input } from '@mashora/design-system'
import { Lock, Search } from 'lucide-react'
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

interface GroupOption {
  id: number
  name: string
}

function m2oName(val: [number, string] | number | null | undefined): string {
  if (Array.isArray(val)) return val[1]
  return ''
}

function m2oId(val: [number, string] | number | null | undefined): number | null {
  if (Array.isArray(val)) return val[0]
  if (typeof val === 'number') return val
  return null
}

export default function AccessRights() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [groupFilter, setGroupFilter] = useState<number | ''>('')

  const { data: groupsData } = useQuery({
    queryKey: ['permission-groups-select'],
    queryFn: async () => {
      const { data } = await erpClient.raw.get('/permissions/groups')
      return data as { records: GroupOption[] }
    },
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['permission-acl-list'] })
    },
    onError: () => toast.error('Failed to update permission'),
  })

  const records = data?.records || []
  const groups = groupsData?.records || []

  return (
    <div className="space-y-4">
      <PageHeader title="Access Rights" subtitle="settings" backTo="/admin/settings" />

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          value={groupFilter}
          onChange={e => setGroupFilter(e.target.value ? Number(e.target.value) : '')}
          className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
        >
          <option value="">All groups</option>
          {groups.map(g => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>
      </div>

      <Card className="rounded-2xl">
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/20">
                <th className="text-left px-4 py-3 font-medium">Name</th>
                <th className="text-left px-4 py-3 font-medium">Model</th>
                <th className="text-left px-4 py-3 font-medium">Group</th>
                <th className="text-center px-3 py-3 font-medium">Read</th>
                <th className="text-center px-3 py-3 font-medium">Write</th>
                <th className="text-center px-3 py-3 font-medium">Create</th>
                <th className="text-center px-3 py-3 font-medium">Delete</th>
                <th className="text-center px-3 py-3 font-medium">Active</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Loading...</td></tr>
              ) : records.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">No access rules found</td></tr>
              ) : (
                records.map(acl => (
                  <tr key={acl.id} className="border-b last:border-0 hover:bg-muted/10 transition-colors">
                    <td className="px-4 py-3 font-medium">{acl.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{m2oName(acl.model_id)}</td>
                    <td className="px-4 py-3">
                      {m2oName(acl.group_id) ? (
                        <Badge variant="secondary" className="rounded-full text-xs">{m2oName(acl.group_id)}</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </td>
                    {(['perm_read', 'perm_write', 'perm_create', 'perm_unlink'] as const).map(f => (
                      <td key={f} className="text-center px-3 py-3">
                        <button
                          onClick={() => toggleMut.mutate({ id: acl.id, field: f, value: !acl[f] })}
                          className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                            acl[f]
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {acl[f] ? '\u2713' : '\u2715'}
                        </button>
                      </td>
                    ))}
                    <td className="text-center px-3 py-3">
                      <button
                        onClick={() => toggleMut.mutate({ id: acl.id, field: 'active', value: !acl.active })}
                        className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                          acl.active
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {acl.active ? '\u2713' : '\u2715'}
                      </button>
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
