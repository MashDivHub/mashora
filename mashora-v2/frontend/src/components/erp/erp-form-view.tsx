import { useEffect, useMemo, useState } from 'react'
import { Save } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { formatFieldValue, recordTitle } from '@/lib/format'
import type { ParsedFormView } from '@/lib/erp-view'
import type { ErpFieldDefinition, ErpRecord } from '@/services/erp/views'

interface ErpFormViewProps {
  parsedView: ParsedFormView | null
  record: ErpRecord | null
  fields: Record<string, ErpFieldDefinition>
  saving: boolean
  onSave: (values: Record<string, unknown>) => Promise<boolean>
}

function normalizeInputValue(value: unknown, field?: ErpFieldDefinition) {
  if (value === null || value === undefined || value === false) {
    return ''
  }
  if (Array.isArray(value)) {
    return typeof value[1] === 'string' ? value[1] : ''
  }
  if (field?.type === 'date') {
    return String(value).slice(0, 10)
  }
  if (field?.type === 'datetime') {
    const date = new Date(String(value))
    if (!Number.isNaN(date.getTime())) {
      return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
    }
  }
  return String(value)
}

function serializeValue(rawValue: unknown, field?: ErpFieldDefinition) {
  if (field?.type === 'boolean') {
    return Boolean(rawValue)
  }
  if (rawValue === '') {
    return false
  }
  if (field?.type === 'integer') {
    return Number.parseInt(String(rawValue), 10)
  }
  if (field?.type === 'float' || field?.type === 'monetary') {
    return Number.parseFloat(String(rawValue))
  }
  return rawValue
}

function isEditableField(field?: ErpFieldDefinition) {
  if (!field || field.readonly) {
    return false
  }
  return !['many2one', 'one2many', 'many2many', 'reference', 'binary', 'html'].includes(field.type)
}

export function ErpFormView({
  parsedView,
  record,
  fields,
  saving,
  onSave,
}: ErpFormViewProps) {
  const [draft, setDraft] = useState<Record<string, unknown>>({})

  useEffect(() => {
    setDraft(record || {})
  }, [record])

  const changedValues = useMemo(() => {
    if (!record || !parsedView) {
      return {}
    }
    const changes: Record<string, unknown> = {}
    parsedView.sections.forEach((section) => {
      section.fields.forEach((fieldMeta) => {
        const field = fields[fieldMeta.name]
        if (!isEditableField(field)) {
          return
        }
        const nextValue = serializeValue(draft[fieldMeta.name], field)
        const currentValue = serializeValue(record[fieldMeta.name], field)
        if (JSON.stringify(nextValue) !== JSON.stringify(currentValue)) {
          changes[fieldMeta.name] = nextValue
        }
      })
    })
    return changes
  }, [draft, fields, parsedView, record])

  if (!record) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No record selected</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Pick a row or kanban card to inspect and edit it in the new form surface.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-border/60">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle>{recordTitle(record)}</CardTitle>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge variant="outline">ID {record.id}</Badge>
              <Badge variant="secondary">Live backend record</Badge>
            </div>
          </div>
          <Button
            type="button"
            onClick={() => void onSave(changedValues)}
            disabled={saving || !Object.keys(changedValues).length}
          >
            <Save className="size-4" />
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 p-6">
        {parsedView?.sections.map((section) => (
          <section key={section.title} className="space-y-4">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {section.title}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {section.fields.map((fieldMeta) => {
                const field = fields[fieldMeta.name]
                const editable = isEditableField(field)
                const fieldValue = draft[fieldMeta.name]
                const fullWidth = field?.type === 'text'

                return (
                  <div key={fieldMeta.name} className={fullWidth ? 'md:col-span-2' : ''}>
                    <Label className="mb-2 block">{fieldMeta.label}</Label>

                    {!editable ? (
                      <div className="rounded-2xl border border-border/60 bg-card/60 px-3 py-2.5 text-sm text-muted-foreground">
                        {formatFieldValue(record[fieldMeta.name], field)}
                      </div>
                    ) : field?.type === 'selection' && field.selection?.length ? (
                      <select
                        className="flex h-11 w-full rounded-2xl border border-input bg-background/80 px-3 py-2 text-sm outline-none ring-offset-background focus:border-ring focus:ring-2 focus:ring-ring/20"
                        value={normalizeInputValue(fieldValue, field)}
                        onChange={(event) =>
                          setDraft((previous) => ({ ...previous, [fieldMeta.name]: event.target.value }))
                        }
                      >
                        <option value="">Select an option</option>
                        {field.selection.map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    ) : field?.type === 'boolean' ? (
                      <button
                        type="button"
                        className="flex h-11 w-full items-center justify-between rounded-2xl border border-input bg-background/80 px-3 py-2 text-sm"
                        onClick={() =>
                          setDraft((previous) => ({
                            ...previous,
                            [fieldMeta.name]: !Boolean(previous[fieldMeta.name]),
                          }))
                        }
                      >
                        <span>{Boolean(fieldValue) ? 'Enabled' : 'Disabled'}</span>
                        <Badge variant={Boolean(fieldValue) ? 'success' : 'outline'}>
                          {Boolean(fieldValue) ? 'On' : 'Off'}
                        </Badge>
                      </button>
                    ) : field?.type === 'text' ? (
                      <Textarea
                        value={normalizeInputValue(fieldValue, field)}
                        onChange={(event) =>
                          setDraft((previous) => ({ ...previous, [fieldMeta.name]: event.target.value }))
                        }
                      />
                    ) : (
                      <Input
                        type={
                          field?.type === 'integer' || field?.type === 'float' || field?.type === 'monetary'
                            ? 'number'
                            : field?.type === 'date'
                              ? 'date'
                              : field?.type === 'datetime'
                                ? 'datetime-local'
                                : 'text'
                        }
                        value={normalizeInputValue(fieldValue, field)}
                        onChange={(event) =>
                          setDraft((previous) => ({ ...previous, [fieldMeta.name]: event.target.value }))
                        }
                      />
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        ))}
      </CardContent>
    </Card>
  )
}
