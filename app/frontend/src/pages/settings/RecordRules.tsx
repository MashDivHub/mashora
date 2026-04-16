import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Badge, Card, CardContent, Input } from '@mashora/design-system'
import { Key, Search } from 'lucide-react'
import { PageHeader, toast } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'

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

export default function RecordRules() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['permission-rules', search],
    queryFn: async () => {
      const params: Record<string, any> = {}
      if (search) params.search = search
      const { data } = await erpClient.raw.get('/permissions/rules', { params })
      return data as { records: RuleRecord[] }
    },
  })

  const toggleMut = useMutation({
    mutationFn: async ({ id, field, value }: { id: number; field: string; value: boolean }) => {
      await erpClient.raw.put(`/permissions/rules/${id}`, { [field]: value })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['permission-rules'] })
    },
    onError: () => toast.error('Failed to update rule'),
  })

  const records = data?.records || []

  return (
    <div className="space-y-4">
      <PageHeader title="Record Rules" subtitle="settings" backTo="/admin/settings" />

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search rules..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

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
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">Loading...</td></tr>
              ) : records.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">No record rules found</td></tr>
              ) : (
                records.map(rule => (
                  <tr key={rule.id} className="border-b last:border-0 hover:bg-muted/10 transition-colors">
                    <td className="px-4 py-3 font-medium">{rule.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{m2oName(rule.model_id)}</td>
                    <td className="px-4 py-3 max-w-[250px]">
                      {rule.domain_force ? (
                        <code className="text-xs bg-muted px-2 py-1 rounded block truncate" title={rule.domain_force}>
                          {rule.domain_force}
                        </code>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="text-center px-3 py-3">
                      <Badge
                        variant={rule.global ? 'default' : 'secondary'}
                        className="rounded-full text-xs"
                      >
                        {rule.global ? 'Global' : 'Group'}
                      </Badge>
                    </td>
                    {(['perm_read', 'perm_write', 'perm_create', 'perm_unlink'] as const).map(f => (
                      <td key={f} className="text-center px-3 py-3">
                        <button
                          onClick={() => toggleMut.mutate({ id: rule.id, field: f, value: !rule[f] })}
                          className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                            rule[f]
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {rule[f] ? '\u2713' : '\u2715'}
                        </button>
                      </td>
                    ))}
                    <td className="text-center px-3 py-3">
                      <button
                        onClick={() => toggleMut.mutate({ id: rule.id, field: 'active', value: !rule.active })}
                        className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                          rule.active
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {rule.active ? '\u2713' : '\u2715'}
                      </button>
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
