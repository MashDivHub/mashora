import { useQuery } from '@tanstack/react-query'
import { PageHeader } from '@/components/shared'
import { Badge } from '@mashora/design-system'
import { erpClient } from '@/lib/erp-api'
import { Users } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface EmployeeRecord {
  id: number
  name: string
  job_title: string | false
  department_id: [number, string] | false
  parent_id: [number, string] | false
}

// ─── Tree helpers ─────────────────────────────────────────────────────────────

function buildTree(employees: EmployeeRecord[]): Map<number | false, EmployeeRecord[]> {
  const map = new Map<number | false, EmployeeRecord[]>()
  for (const emp of employees) {
    const parentKey = emp.parent_id === false ? false : emp.parent_id[0]
    if (!map.has(parentKey)) map.set(parentKey, [])
    map.get(parentKey)!.push(emp)
  }
  return map
}

// ─── Tree node ────────────────────────────────────────────────────────────────

interface TreeNodeProps {
  employee: EmployeeRecord
  childMap: Map<number | false, EmployeeRecord[]>
  depth: number
}

function TreeNode({ employee, childMap, depth }: TreeNodeProps) {
  const children = childMap.get(employee.id) ?? []

  return (
    <div>
      {/* Node row */}
      <div className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-muted/30 transition-colors">
        <div className="min-w-0 flex-1">
          <span className="font-medium text-foreground text-sm">{employee.name}</span>
          {employee.job_title && (
            <span className="ml-2 text-xs text-muted-foreground">{employee.job_title}</span>
          )}
        </div>
        {employee.department_id && (
          <Badge variant="secondary" className="shrink-0 text-xs">
            {employee.department_id[1]}
          </Badge>
        )}
      </div>

      {/* Children */}
      {depth < 5 && children.length > 0 && (
        <div className="pl-8 ml-3 border-l-2 border-border/30 mt-0.5 space-y-0.5">
          {children.map(child => (
            <TreeNode
              key={child.id}
              employee={child}
              childMap={childMap}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OrgChart() {
  const { data, isLoading } = useQuery({
    queryKey: ['org-chart'],
    queryFn: () =>
      erpClient.raw
        .post('/hr/employees', { limit: 500, order: 'parent_id asc' })
        .then(r => r.data),
  })

  const employees: EmployeeRecord[] = data?.records ?? []
  const childMap = buildTree(employees)
  const roots = childMap.get(false) ?? []

  return (
    <div className="space-y-4">
      <PageHeader
        title="Org Chart"
        subtitle={isLoading ? undefined : `${employees.length} employee${employees.length !== 1 ? 's' : ''}`}
      />

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-9 rounded-lg bg-muted/40 animate-pulse" style={{ width: `${70 + (i % 3) * 10}%` }} />
          ))}
        </div>
      ) : roots.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-muted-foreground">
          <Users className="h-10 w-10" />
          <p className="text-sm">No employees found</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border/30 bg-card/50 p-4 space-y-0.5">
          {roots.map(root => (
            <TreeNode
              key={root.id}
              employee={root}
              childMap={childMap}
              depth={0}
            />
          ))}
        </div>
      )}
    </div>
  )
}
