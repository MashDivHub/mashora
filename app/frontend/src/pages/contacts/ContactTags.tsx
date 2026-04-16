import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Input, Button, Badge } from '@mashora/design-system'
import { Tag, Plus, Trash2, Pencil, Check, X } from 'lucide-react'
import { PageHeader, DataTable, SearchBar, type Column } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'

export default function ContactTags() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [newName, setNewName] = useState('')
  const [showNew, setShowNew] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['contact-tags', search],
    queryFn: async () => {
      const domain = search ? [['name', 'ilike', search]] : undefined
      const { data } = await erpClient.raw.post('/model/res.partner.category', {
        domain,
        fields: ['id', 'name', 'color', 'parent_id', 'partner_ids'],
        order: 'name asc',
        limit: 200,
      })
      return data
    },
  })

  const createMut = useMutation({
    mutationFn: async (name: string) => {
      await erpClient.raw.post('/model/res.partner.category/create', { vals: { name } })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact-tags'] })
      setNewName('')
      setShowNew(false)
    },
  })

  const updateMut = useMutation({
    mutationFn: async ({ id, name }: { id: number; name: string }) => {
      await erpClient.raw.put(`/model/res.partner.category/${id}`, { vals: { name } })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact-tags'] })
      setEditingId(null)
    },
  })

  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      await erpClient.raw.delete(`/model/res.partner.category/${id}`)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['contact-tags'] }),
  })

  const records = data?.records || []

  const columns: Column[] = [
    {
      key: 'name',
      label: 'Tag Name',
      render: (_, row) => {
        if (editingId === row.id) {
          return (
            <div className="flex items-center gap-2">
              <Input
                value={editName}
                onChange={e => setEditName(e.target.value)}
                className="h-8 rounded-lg w-48"
                autoFocus
                onKeyDown={e => {
                  if (e.key === 'Enter') updateMut.mutate({ id: row.id, name: editName })
                  if (e.key === 'Escape') setEditingId(null)
                }}
              />
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => updateMut.mutate({ id: row.id, name: editName })}>
                <Check className="h-3.5 w-3.5 text-emerald-500" />
              </Button>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setEditingId(null)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          )
        }
        return (
          <div className="flex items-center gap-2">
            <Tag className="h-3.5 w-3.5 text-muted-foreground" />
            <Badge variant="secondary" className="rounded-full">{row.name}</Badge>
          </div>
        )
      },
    },
    {
      key: 'parent_id',
      label: 'Parent',
      format: val => Array.isArray(val) ? val[1] : '',
    },
    {
      key: 'partner_ids',
      label: 'Contacts',
      align: 'right',
      render: val => <span className="text-muted-foreground tabular-nums">{Array.isArray(val) ? val.length : 0}</span>,
    },
    {
      key: '_actions',
      label: '',
      sortable: false,
      width: '80px',
      render: (_, row) => (
        <div className="flex items-center gap-1 justify-end" onClick={e => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => { setEditingId(row.id); setEditName(row.name) }}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
            onClick={() => { if (confirm(`Delete tag "${row.name}"?`)) deleteMut.mutate(row.id) }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <PageHeader
        title="Contact Tags"
        subtitle="contacts"
        backTo="/admin/contacts"
        onNew={() => setShowNew(true)}
      />

      {showNew && (
        <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-card p-3">
          <Tag className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="New tag name..."
            className="h-8 rounded-lg flex-1"
            autoFocus
            onKeyDown={e => {
              if (e.key === 'Enter' && newName.trim()) createMut.mutate(newName.trim())
              if (e.key === 'Escape') setShowNew(false)
            }}
          />
          <Button size="sm" className="rounded-lg h-8" onClick={() => newName.trim() && createMut.mutate(newName.trim())} disabled={!newName.trim()}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Create
          </Button>
          <Button variant="ghost" size="sm" className="rounded-lg h-8" onClick={() => setShowNew(false)}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      <SearchBar placeholder="Search tags..." onSearch={setSearch} />

      <DataTable
        columns={columns}
        data={records}
        total={data?.total}
        loading={isLoading}
        emptyMessage="No tags found"
        emptyIcon={<Tag className="h-10 w-10" />}
      />
    </div>
  )
}
