import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Skeleton, Button } from '@mashora/design-system'
import { Plus } from 'lucide-react'
import type { ViewProps } from '../../ViewRegistry'
import { fetchViewDefinition } from '../../ActionService'
import { loadKanbanData, moveRecord, extractKanbanFields } from './KanbanController'
import { erpClient } from '@/lib/erp-api'
import KanbanColumn from './KanbanColumn'
import KanbanCard from './KanbanCard'

export default function KanbanView({ model, action, domain: actionDomain }: ViewProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: viewDef } = useQuery({
    queryKey: ['viewDef', model, 'kanban'],
    queryFn: () => fetchViewDefinition(model, 'kanban'),
    staleTime: 5 * 60 * 1000,
  })

  const { groupByField, cardFields } = viewDef
    ? extractKanbanFields(viewDef.arch)
    : { groupByField: null, cardFields: ['id', 'name'] }

  // Grouped kanban: use read_group + records per group
  const { data: columns, isLoading: columnsLoading } = useQuery({
    queryKey: ['kanban', model, groupByField, actionDomain],
    queryFn: () => loadKanbanData(model, groupByField!, actionDomain || [], cardFields),
    enabled: !!viewDef && !!groupByField,
  })

  // Ungrouped kanban: fetch flat records
  const { data: flatRecords, isLoading: flatLoading } = useQuery({
    queryKey: ['kanban-flat', model, actionDomain],
    queryFn: async () => {
      const { data } = await erpClient.raw.post(`/model/${model}`, {
        domain: actionDomain?.length ? actionDomain : undefined,
        fields: cardFields.length ? cardFields : undefined,
        limit: 80,
      })
      return data.records || []
    },
    enabled: !!viewDef && !groupByField,
  })

  const isLoading = columnsLoading || flatLoading

  const handleCardClick = useCallback(
    (recordId: number) => navigate(`/model/${model}/${recordId}`),
    [navigate, model],
  )

  const handleDrop = useCallback(
    async (recordId: number, newGroupValue: any) => {
      if (!groupByField) return
      await moveRecord(model, recordId, groupByField, newGroupValue)
      queryClient.invalidateQueries({ queryKey: ['kanban', model] })
    },
    [model, groupByField, queryClient],
  )

  const handleQuickCreate = useCallback(
    () => navigate(`/model/${model}/new`),
    [navigate, model],
  )

  const modelLabel = model.split('.').pop()?.replace(/_/g, ' ') || model

  void handleDrop

  if (isLoading || !viewDef) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48 rounded-2xl" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-2xl" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
            {model.replace(/\./g, ' ')}
          </p>
          <h1 className="text-xl font-semibold tracking-tight capitalize">
            {action?.name || modelLabel}
          </h1>
        </div>
        <Button
          size="sm"
          className="rounded-xl gap-1.5"
          onClick={() => navigate(`/model/${model}/new`)}
        >
          <Plus className="h-3.5 w-3.5" /> New
        </Button>
      </div>

      {/* Kanban board — grouped or flat */}
      {groupByField ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {(columns || []).map((col, i) => (
            <KanbanColumn
              key={i}
              column={col}
              fields={viewDef.fields}
              cardFields={cardFields}
              onCardClick={handleCardClick}
              onQuickCreate={handleQuickCreate}
            />
          ))}
          {columns && columns.length === 0 && (
            <div className="flex-1 rounded-3xl border border-dashed border-border/60 p-12 text-center text-muted-foreground">
              <p className="text-lg font-medium">No stages found</p>
              <p className="text-sm mt-1">Configure stages for this model to use grouped kanban.</p>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {(flatRecords || []).map((rec: any) => (
            <KanbanCard
              key={rec.id}
              record={rec}
              fields={viewDef.fields}
              cardFields={cardFields}
              onClick={() => handleCardClick(rec.id)}
            />
          ))}
          {flatRecords && flatRecords.length === 0 && (
            <div className="col-span-full rounded-3xl border border-dashed border-border/60 p-12 text-center text-muted-foreground">
              <p className="text-lg font-medium">No records</p>
              <Button variant="ghost" size="sm" className="mt-2 gap-1.5 text-primary" onClick={handleQuickCreate}>
                <Plus className="h-3.5 w-3.5" /> Create new
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
