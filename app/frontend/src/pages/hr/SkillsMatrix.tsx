import { useQuery } from '@tanstack/react-query'
import { DataTable, PageHeader } from '@/components/shared'
import type { Column } from '@/components/shared/DataTable'
import { Badge } from '@mashora/design-system'
import { erpClient } from '@/lib/erp-api'
import { Layers } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface SkillRecord {
  id: number
  employee_id: [number, string] | false
  skill_id: [number, string] | false
  skill_level_id: [number, string] | false
  skill_type_id: [number, string] | false
}

// ─── Columns ──────────────────────────────────────────────────────────────────

const columns: Column<SkillRecord>[] = [
  {
    key: 'employee_id',
    label: 'Employee',
    render: (v) => (Array.isArray(v) ? v[1] : '—'),
  },
  {
    key: 'skill_type_id',
    label: 'Skill Type',
    render: (v) =>
      Array.isArray(v) ? (
        <Badge variant="secondary">{v[1]}</Badge>
      ) : (
        '—'
      ),
  },
  {
    key: 'skill_id',
    label: 'Skill',
    render: (v) => (Array.isArray(v) ? v[1] : '—'),
  },
  {
    key: 'skill_level_id',
    label: 'Level',
    render: (v) =>
      Array.isArray(v) ? (
        <Badge variant="info">{v[1]}</Badge>
      ) : (
        '—'
      ),
  },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SkillsMatrix() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['skills-matrix'],
    queryFn: () =>
      erpClient.raw
        .post('/model/hr.employee.skill', {
          fields: ['id', 'employee_id', 'skill_id', 'skill_level_id', 'skill_type_id'],
          order: 'employee_id asc',
          limit: 500,
        })
        .then(r => r.data),
    retry: false,
  })

  // If the model doesn't exist the API will return an error
  const notInstalled =
    isError ||
    (error != null && typeof error === 'object' && 'message' in error && String((error as any).message).toLowerCase().includes('model'))

  if (notInstalled) {
    return (
      <div className="space-y-4">
        <PageHeader title="Skills Matrix" />
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-border/30 bg-card/50 py-20 text-muted-foreground">
          <Layers className="h-10 w-10" />
          <p className="text-sm font-medium">Skills module not installed</p>
          <p className="text-xs">Enable the Skills module to use this feature.</p>
        </div>
      </div>
    )
  }

  const records: SkillRecord[] = data?.records ?? []
  const total: number = data?.total ?? records.length

  return (
    <div className="space-y-4">
      <PageHeader
        title="Skills Matrix"
        subtitle={isLoading ? undefined : `${total} skill${total !== 1 ? 's' : ''}`}
      />

      <DataTable
        columns={columns}
        data={records}
        total={total}
        page={0}
        pageSize={500}
        onPageChange={() => {}}
        loading={isLoading}
        emptyMessage="No skills recorded"
        emptyIcon={<Layers className="h-10 w-10" />}
      />
    </div>
  )
}
