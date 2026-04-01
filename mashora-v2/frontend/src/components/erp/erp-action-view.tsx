import { useMemo, useState } from 'react'
import { KanbanSquare, RefreshCcw, Search, SquarePen, TableProperties, TriangleAlert } from 'lucide-react'
import { ErpEmptyState } from '@/components/erp/erp-empty-state'
import { ErpFormView } from '@/components/erp/erp-form-view'
import { ErpKanbanView } from '@/components/erp/erp-kanban-view'
import { ErpListView } from '@/components/erp/erp-list-view'
import { ErpStats } from '@/components/erp/erp-stats'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatFieldValue, formatShortNumber } from '@/lib/format'
import type { ParsedFormView, ParsedKanbanView, ParsedListView, SupportedViewMode } from '@/lib/erp-view'
import type { ErpAction } from '@/services/erp/actions'
import type { ErpFieldDefinition, ErpRecord } from '@/services/erp/views'

interface ErpActionViewProps {
  action: ErpAction | null
  loading: boolean
  saving: boolean
  error: string | null
  fields: Record<string, ErpFieldDefinition>
  records: ErpRecord[]
  totalRecords: number
  selectedRecord: ErpRecord | null
  currentView: SupportedViewMode
  availableViews: SupportedViewMode[]
  parsedList: ParsedListView | null
  parsedKanban: ParsedKanbanView | null
  parsedForm: ParsedFormView | null
  normalizedDomain: unknown[]
  onSelectRecord: (recordId: number) => void
  onChangeView: (view: SupportedViewMode) => void
  onSaveRecord: (values: Record<string, unknown>) => Promise<boolean>
  onReload: () => void
}

const viewIcons: Record<SupportedViewMode, typeof TableProperties> = {
  list: TableProperties,
  kanban: KanbanSquare,
  form: SquarePen,
}

export function ErpActionView({
  action,
  loading,
  saving,
  error,
  fields,
  records,
  totalRecords,
  selectedRecord,
  currentView,
  availableViews,
  parsedList,
  parsedKanban,
  parsedForm,
  normalizedDomain,
  onSelectRecord,
  onChangeView,
  onSaveRecord,
  onReload,
}: ErpActionViewProps) {
  const [query, setQuery] = useState('')

  const filteredRecords = useMemo(() => {
    if (!query.trim()) {
      return records
    }
    const normalizedQuery = query.toLowerCase()
    return records.filter((record) =>
      Object.entries(record).some(([, value]) => formatFieldValue(value).toLowerCase().includes(normalizedQuery))
    )
  }, [query, records])

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40 rounded-[28px]" />
        <Skeleton className="h-[420px] rounded-[28px]" />
      </div>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-red-500/10 text-red-400">
              <TriangleAlert className="size-5" />
            </div>
            <div>
              <CardTitle>Action failed to load</CardTitle>
              <div className="mt-1 text-sm text-muted-foreground">{error}</div>
            </div>
          </div>
        </CardHeader>
      </Card>
    )
  }

  if (!action) {
    return (
      <ErpEmptyState
        title="Pick a workspace"
        description="Select a module or submenu from the new navigation shell to load its action."
      />
    )
  }

  const statItems = [
    {
      label: 'Records',
      value: formatShortNumber(totalRecords),
      hint: `${filteredRecords.length} loaded in this surface`,
    },
    {
      label: 'Model',
      value: action.res_model || 'Client action',
      hint: `${availableViews.join(' / ') || 'no'} supported renderer`,
    },
    {
      label: 'Domain',
      value: normalizedDomain.length ? `${normalizedDomain.length} clauses` : 'All data',
      hint: 'Using existing backend action rules',
    },
  ]

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-sm font-medium text-primary">Reworked frontend surface</div>
            <CardTitle className="mt-2 text-2xl">{action.name}</CardTitle>
            <div className="mt-2 text-sm text-muted-foreground">
              {action.res_model ? `Bound to ${action.res_model}` : 'Client action'}
            </div>
          </div>
          <div className="flex flex-col gap-3 md:min-w-[340px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search loaded records..."
                className="pl-9"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={onReload}>
                <RefreshCcw className="size-4" />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <ErpStats items={statItems} />

          {availableViews.length ? (
            <Tabs value={currentView} onValueChange={(value) => onChangeView(value as SupportedViewMode)}>
              <TabsList>
                {availableViews.map((view) => {
                  const Icon = viewIcons[view]
                  return (
                    <TabsTrigger key={view} value={view}>
                      <Icon className="size-4" />
                      {view}
                    </TabsTrigger>
                  )
                })}
              </TabsList>
            </Tabs>
          ) : null}
        </CardContent>
      </Card>

      {!records.length ? (
        <ErpEmptyState
          title="No records returned"
          description="The backend action loaded correctly, but the current domain did not return visible records."
        />
      ) : currentView === 'form' ? (
        <ErpFormView
          parsedView={parsedForm}
          record={selectedRecord}
          fields={fields}
          saving={saving}
          onSave={onSaveRecord}
        />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_420px]">
          <div>
            {currentView === 'list' && parsedList ? (
              <ErpListView
                columns={parsedList.columns}
                records={filteredRecords}
                fields={fields}
                selectedRecordId={selectedRecord?.id}
                onSelectRecord={onSelectRecord}
              />
            ) : null}

            {currentView === 'kanban' && parsedKanban ? (
              <ErpKanbanView
                parsedView={parsedKanban}
                records={filteredRecords}
                fields={fields}
                selectedRecordId={selectedRecord?.id}
                onSelectRecord={onSelectRecord}
              />
            ) : null}
          </div>

          <div className="xl:sticky xl:top-28 xl:self-start">
            <ErpFormView
              parsedView={parsedForm}
              record={selectedRecord}
              fields={fields}
              saving={saving}
              onSave={onSaveRecord}
            />
          </div>
        </div>
      )}
    </div>
  )
}
