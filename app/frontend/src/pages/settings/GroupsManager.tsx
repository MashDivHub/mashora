import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Badge, Button, Card, CardContent, Input, Tabs, TabsList, TabsTrigger, TabsContent } from '@mashora/design-system'
import { Shield, Users, Search, X, Plus, Trash2 } from 'lucide-react'
import { PageHeader, SearchBar, toast, LoadingState } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'
import { extractErrorMessage } from '@/lib/errors'

// ── Types ──

interface Group {
  id: number
  name: string
  comment: string | null
  user_count: number
}

interface GroupUser {
  id: number
  login: string
  name: string | null
}

interface GroupDetail extends Group {
  users: GroupUser[]
}

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

// ── Group List ──

function GroupList() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newComment, setNewComment] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['permission-groups'],
    queryFn: async () => {
      const { data } = await erpClient.raw.get('/permissions/groups')
      return data as { records: Group[] }
    },
  })

  const createMut = useMutation({
    mutationFn: async () => {
      await erpClient.raw.post('/permissions/groups', { name: newName.trim(), comment: newComment.trim() || null })
    },
    onSuccess: () => {
      toast.success(`Group "${newName}" created`)
      setNewName(''); setNewComment(''); setShowCreate(false)
      qc.invalidateQueries({ queryKey: ['permission-groups'] })
    },
    onError: (e: unknown) => toast.error(extractErrorMessage(e, 'Create failed')),
  })

  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      await erpClient.raw.delete(`/permissions/groups/${id}`)
    },
    onSuccess: () => { toast.success('Group deleted'); qc.invalidateQueries({ queryKey: ['permission-groups'] }) },
    onError: (e: unknown) => toast.error(extractErrorMessage(e, 'Delete failed')),
  })

  const groups = (data?.records || []).filter(
    g => !search || g.name?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-4">
      <PageHeader title="Groups & Roles" subtitle="settings" backTo="/admin/settings" />

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search groups..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Button className="rounded-xl" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-1.5" /> New Group
        </Button>
      </div>

      {showCreate && (
        <Card className="rounded-2xl border-primary/30 shadow-lg">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">New Group</h3>
              <button onClick={() => setShowCreate(false)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
              <Input placeholder="Group name" value={newName} onChange={e => setNewName(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Enter' && newName.trim()) createMut.mutate() }} />
              <Input placeholder="Description (optional)" value={newComment} onChange={e => setNewComment(e.target.value)} />
            </div>
            <div className="flex gap-2 mt-3">
              <Button onClick={() => createMut.mutate()} disabled={!newName.trim() || createMut.isPending} className="rounded-xl">Create</Button>
              <Button variant="ghost" onClick={() => setShowCreate(false)} className="rounded-xl">Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="rounded-2xl">
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/20">
                <th className="text-left px-4 py-3 font-medium">Group</th>
                <th className="text-left px-4 py-3 font-medium">Description</th>
                <th className="text-right px-4 py-3 font-medium">Users</th>
                <th className="text-right px-4 py-3 font-medium w-16"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center"><LoadingState label="Loading groups..." /></td></tr>
              ) : groups.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                        <Shield className="h-6 w-6" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold">No groups yet</p>
                        <p className="text-xs text-muted-foreground mt-1">Groups bundle permissions together for easier role assignment.</p>
                      </div>
                      <Button size="sm" onClick={() => setShowCreate(true)} className="rounded-xl gap-2">
                        <Plus className="h-4 w-4" /> Create First Group
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : (
                groups.map(g => (
                  <tr key={g.id} className="border-b last:border-0 hover:bg-muted/10 transition-colors group">
                    <td className="px-4 py-3 cursor-pointer" onClick={() => navigate(`/admin/settings/groups/${g.id}`)}>
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-primary shrink-0" />
                        <span className="font-medium">{g.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground truncate max-w-[300px] cursor-pointer" onClick={() => navigate(`/admin/settings/groups/${g.id}`)}>{g.comment || '-'}</td>
                    <td className="px-4 py-3 text-right cursor-pointer" onClick={() => navigate(`/admin/settings/groups/${g.id}`)}>
                      <Badge variant="secondary" className="rounded-full text-xs gap-1"><Users className="h-3 w-3" />{g.user_count}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive" onClick={() => { if (confirm(`Delete group "${g.name}"?`)) deleteMut.mutate(g.id) }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}

// ── Group Detail ──

function GroupDetail({ groupId }: { groupId: number }) {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [addLogin, setAddLogin] = useState('')

  const { data: group, isLoading } = useQuery({
    queryKey: ['permission-group', groupId],
    queryFn: async () => {
      const { data } = await erpClient.raw.get(`/permissions/groups/${groupId}`)
      return data as GroupDetail
    },
  })

  const { data: aclData } = useQuery({
    queryKey: ['permission-acl', { group_id: groupId }],
    queryFn: async () => {
      const { data } = await erpClient.raw.get('/permissions/acl', { params: { group_id: groupId } })
      return data as { records: AclRecord[] }
    },
  })

  const { data: allUsers } = useQuery({
    queryKey: ['all-users-search', addLogin],
    queryFn: async () => {
      if (!addLogin || addLogin.length < 2) return { records: [] }
      const { data } = await erpClient.raw.post('/model/res.users', {
        domain: [['active', '=', true], '|', ['login', 'ilike', addLogin], ['name', 'ilike', addLogin]],
        fields: ['id', 'login', 'name'],
        limit: 10,
      })
      return data as { records: { id: number; login: string; name: string }[] }
    },
    enabled: addLogin.length >= 2,
  })

  const addUserMut = useMutation({
    mutationFn: async (userId: number) => {
      await erpClient.raw.post(`/permissions/groups/${groupId}/users`, { user_id: userId })
    },
    onSuccess: () => {
      toast.success('User added to group')
      setAddLogin('')
      qc.invalidateQueries({ queryKey: ['permission-group', groupId] })
      qc.invalidateQueries({ queryKey: ['permission-groups'] })
    },
    onError: () => toast.error('Failed to add user'),
  })

  const removeUserMut = useMutation({
    mutationFn: async (userId: number) => {
      await erpClient.raw.delete(`/permissions/groups/${groupId}/users/${userId}`)
    },
    onSuccess: () => {
      toast.success('User removed from group')
      qc.invalidateQueries({ queryKey: ['permission-group', groupId] })
      qc.invalidateQueries({ queryKey: ['permission-groups'] })
    },
    onError: () => toast.error('Failed to remove user'),
  })

  const toggleAcl = useMutation({
    mutationFn: async ({ id, field, value }: { id: number; field: string; value: boolean }) => {
      await erpClient.raw.put(`/permissions/acl/${id}`, { [field]: value })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['permission-acl', { group_id: groupId }] })
    },
    onError: () => toast.error('Failed to update permission'),
  })

  if (isLoading || !group) {
    return <div className="space-y-4"><PageHeader title="Loading group..." backTo="/admin/settings/groups" /><LoadingState /></div>
  }

  const aclRecords = aclData?.records || []

  return (
    <div className="space-y-4">
      <PageHeader title={group.name} subtitle="groups" backTo="/admin/settings/groups" />

      {group.comment && (
        <p className="text-sm text-muted-foreground">{group.comment}</p>
      )}

      <Tabs defaultValue="users">
        <TabsList className="bg-muted/30 border border-border/30 rounded-xl p-1 h-auto">
          <TabsTrigger value="users" className="rounded-lg text-xs">Users ({group.users?.length || 0})</TabsTrigger>
          <TabsTrigger value="acl" className="rounded-lg text-xs">Access Rights ({aclRecords.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-4 space-y-4">
          {/* Add user */}
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search users to add..."
              value={addLogin}
              onChange={e => setAddLogin(e.target.value)}
              className="pl-9"
            />
            {addLogin.length >= 2 && allUsers?.records && allUsers.records.length > 0 && (
              <Card className="absolute z-10 mt-1 w-full rounded-xl shadow-lg">
                <CardContent className="p-1">
                  {allUsers.records.map(u => (
                    <button
                      key={u.id}
                      onClick={() => addUserMut.mutate(u.id)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-muted/20 rounded-lg flex items-center justify-between"
                    >
                      <span>{u.name || u.login}</span>
                      <Plus className="h-3 w-3 text-muted-foreground" />
                    </button>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>

          <Card className="rounded-2xl">
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/20">
                    <th className="text-left px-4 py-3 font-medium">User</th>
                    <th className="text-left px-4 py-3 font-medium">Login</th>
                    <th className="text-right px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {group.users.length === 0 ? (
                    <tr><td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">No users in this group</td></tr>
                  ) : (
                    group.users.map(u => (
                      <tr key={u.id} className="border-b last:border-0 hover:bg-muted/10 transition-colors">
                        <td className="px-4 py-3 font-medium">{u.name || '-'}</td>
                        <td className="px-4 py-3 text-muted-foreground">{u.login}</td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (!window.confirm(`Remove ${u.name || u.login} from this group? This will take effect immediately.`)) return
                              removeUserMut.mutate(u.id)
                            }}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="acl" className="mt-4">
          <Card className="rounded-2xl">
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/20">
                    <th className="text-left px-4 py-3 font-medium">Name</th>
                    <th className="text-left px-4 py-3 font-medium">Model</th>
                    <th className="text-center px-3 py-3 font-medium">Read</th>
                    <th className="text-center px-3 py-3 font-medium">Write</th>
                    <th className="text-center px-3 py-3 font-medium">Create</th>
                    <th className="text-center px-3 py-3 font-medium">Delete</th>
                  </tr>
                </thead>
                <tbody>
                  {aclRecords.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No access rules for this group</td></tr>
                  ) : (
                    aclRecords.map(acl => (
                      <tr key={acl.id} className="border-b last:border-0 hover:bg-muted/10 transition-colors">
                        <td className="px-4 py-3">{acl.name}</td>
                        <td className="px-4 py-3 text-muted-foreground">{m2oName(acl.model_id)}</td>
                        {(['perm_read', 'perm_write', 'perm_create', 'perm_unlink'] as const).map(f => (
                          <td key={f} className="text-center px-3 py-3">
                            <button
                              onClick={() => toggleAcl.mutate({ id: acl.id, field: f, value: !acl[f] })}
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
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ── Main export ──

export default function GroupsManager() {
  const { id } = useParams<{ id: string }>()

  if (id) {
    return <GroupDetail groupId={Number(id)} />
  }
  return <GroupList />
}
