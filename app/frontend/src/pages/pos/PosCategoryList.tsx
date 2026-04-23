import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Button, Skeleton } from '@mashora/design-system'
import { Tags, Plus, ArrowLeft, ChevronRight, Pencil } from 'lucide-react'
import { PageHeader } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'
import { categoryColorClass } from './utils'

interface PosCategory {
  id: number
  name: string
  parent_id: [number, string] | false
  sequence: number
  color: number
}

interface CategoriesResponse {
  records: PosCategory[]
  total: number
}

interface TreeNode {
  cat: PosCategory
  children: TreeNode[]
}

function buildTree(cats: PosCategory[]): TreeNode[] {
  const byId = new Map<number, TreeNode>()
  cats.forEach(c => byId.set(c.id, { cat: c, children: [] }))
  const roots: TreeNode[] = []
  cats.forEach(c => {
    const node = byId.get(c.id)!
    const parentId = Array.isArray(c.parent_id) ? c.parent_id[0] : null
    if (parentId && byId.has(parentId)) {
      byId.get(parentId)!.children.push(node)
    } else {
      roots.push(node)
    }
  })
  const sortChildren = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => (a.cat.sequence ?? 0) - (b.cat.sequence ?? 0) || a.cat.name.localeCompare(b.cat.name))
    nodes.forEach(n => sortChildren(n.children))
  }
  sortChildren(roots)
  return roots
}

function TreeRow({ node, depth, onEdit }: { node: TreeNode; depth: number; onEdit: (id: number) => void }) {
  const colorClass = categoryColorClass(node.cat.color ?? 0)
  return (
    <>
      <div
        onClick={() => onEdit(node.cat.id)}
        className="group flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-muted/40 cursor-pointer transition-all duration-200"
        style={{ paddingLeft: 12 + depth * 24 }}
      >
        {depth > 0 && (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
        )}
        <span
          className={`h-5 w-5 rounded-lg border border-border/40 shrink-0 ${colorClass}`}
          aria-hidden
        />
        <span className="text-sm font-medium flex-1 truncate">{node.cat.name}</span>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground tabular-nums">
          #{node.cat.sequence ?? 0}
        </span>
        <Pencil className="h-3.5 w-3.5 text-muted-foreground/60 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
      </div>
      {node.children.map(child => (
        <TreeRow key={child.cat.id} node={child} depth={depth + 1} onEdit={onEdit} />
      ))}
    </>
  )
}

export default function PosCategoryList() {
  const navigate = useNavigate()
  const { data, isLoading } = useQuery<CategoriesResponse>({
    queryKey: ['pos-categories-list'],
    queryFn: async () => {
      const { data } = await erpClient.raw.get('/pos/categories')
      return data
    },
    staleTime: 30_000,
  })

  const categories = data?.records ?? []
  const tree = useMemo(() => buildTree(categories), [categories])

  return (
    <div className="space-y-6">
      <PageHeader
        title="POS Categories"
        subtitle={isLoading ? 'Loading…' : `${categories.length} categor${categories.length === 1 ? 'y' : 'ies'}`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => navigate('/admin/pos/config')} className="gap-2 rounded-xl">
              <ArrowLeft className="h-4 w-4" /> POS config
            </Button>
            <Button onClick={() => navigate('/admin/pos/categories/new')} className="gap-2 rounded-xl">
              <Plus className="h-4 w-4" /> New category
            </Button>
          </div>
        }
      />

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-xl" />
          ))}
        </div>
      ) : categories.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border/40 bg-gradient-to-br from-primary/5 via-background to-emerald-500/5 p-12 text-center space-y-5">
          <div className="mx-auto rounded-2xl bg-primary/10 p-3 w-fit text-primary">
            <Tags className="h-8 w-8" />
          </div>
          <div className="space-y-1">
            <p className="text-lg font-bold tracking-tight">No categories yet</p>
            <p className="text-sm text-muted-foreground">
              Group your POS products into categories like Drinks, Mains, or Desserts.
            </p>
          </div>
          <Button onClick={() => navigate('/admin/pos/categories/new')} className="gap-2 rounded-xl">
            <Plus className="h-4 w-4" /> Create first category
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {tree.map(root => (
            <div
              key={root.cat.id}
              className="rounded-2xl border border-border/40 bg-card p-2 transition-all duration-200 hover:shadow-sm"
            >
              <TreeRow node={root} depth={0} onEdit={id => navigate(`/admin/pos/categories/${id}`)} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
