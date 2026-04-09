import { useState } from 'react'
import { Button, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, cn } from '@mashora/design-system'
import { Plus, Trash2 } from 'lucide-react'
import type { Domain, DomainLeaf, ComparisonOperator } from '../utils/domain'

interface DomainBuilderProps {
  fields: Record<string, { string: string; type: string; selection?: [string, string][] }>
  onDomainChange: (domain: Domain) => void
  className?: string
}

interface DomainRow {
  id: string
  field: string
  operator: ComparisonOperator
  value: string
}

const OPERATORS: { value: ComparisonOperator; label: string; types: string[] }[] = [
  { value: '=', label: 'equals', types: ['char', 'integer', 'float', 'selection', 'many2one', 'boolean', 'date', 'datetime'] },
  { value: '!=', label: 'not equals', types: ['char', 'integer', 'float', 'selection', 'many2one', 'boolean', 'date', 'datetime'] },
  { value: 'ilike', label: 'contains', types: ['char', 'text'] },
  { value: 'not ilike', label: 'not contains', types: ['char', 'text'] },
  { value: '>', label: 'greater than', types: ['integer', 'float', 'date', 'datetime', 'monetary'] },
  { value: '<', label: 'less than', types: ['integer', 'float', 'date', 'datetime', 'monetary'] },
  { value: '>=', label: 'greater or equal', types: ['integer', 'float', 'date', 'datetime', 'monetary'] },
  { value: '<=', label: 'less or equal', types: ['integer', 'float', 'date', 'datetime', 'monetary'] },
  { value: 'in', label: 'in list', types: ['selection', 'many2one', 'integer'] },
  { value: 'not in', label: 'not in list', types: ['selection', 'many2one', 'integer'] },
]

export default function DomainBuilder({ fields, onDomainChange, className }: DomainBuilderProps) {
  const [rows, setRows] = useState<DomainRow[]>([])

  const fieldOptions = Object.entries(fields)
    .filter(([, meta]) => meta.type !== 'one2many' && meta.type !== 'many2many' && meta.type !== 'binary')
    .sort(([, a], [, b]) => (a.string || '').localeCompare(b.string || ''))

  const addRow = () => {
    setRows(prev => [...prev, { id: `row_${Date.now()}`, field: '', operator: '=', value: '' }])
  }

  const updateRow = (id: string, updates: Partial<DomainRow>) => {
    const newRows = rows.map(r => r.id === id ? { ...r, ...updates } : r)
    setRows(newRows)
    emitDomain(newRows)
  }

  const removeRow = (id: string) => {
    const newRows = rows.filter(r => r.id !== id)
    setRows(newRows)
    emitDomain(newRows)
  }

  const emitDomain = (currentRows: DomainRow[]) => {
    const validRows = currentRows.filter(r => r.field && r.value !== '')
    if (validRows.length === 0) { onDomainChange([]); return }

    const domain: Domain = []
    for (let i = 0; i < validRows.length - 1; i++) domain.push('&')
    for (const row of validRows) {
      let typedValue: unknown = row.value
      const fieldMeta = fields[row.field]
      if (fieldMeta?.type === 'integer' || fieldMeta?.type === 'many2one') typedValue = parseInt(row.value) || 0
      else if (fieldMeta?.type === 'float' || fieldMeta?.type === 'monetary') typedValue = parseFloat(row.value) || 0
      else if (fieldMeta?.type === 'boolean') typedValue = row.value === 'true'
      domain.push([row.field, row.operator, typedValue] as DomainLeaf)
    }
    onDomainChange(domain)
  }

  return (
    <div className={cn('space-y-2', className)}>
      {rows.map(row => {
        const fieldMeta = fields[row.field]
        const applicableOps = fieldMeta
          ? OPERATORS.filter(op => op.types.includes(fieldMeta.type))
          : OPERATORS

        return (
          <div key={row.id} className="flex items-center gap-2">
            <Select value={row.field} onValueChange={v => updateRow(row.id, { field: v, operator: '=', value: '' })}>
              <SelectTrigger className="h-8 w-40 rounded-lg text-xs">
                <SelectValue placeholder="Field..." />
              </SelectTrigger>
              <SelectContent>
                {fieldOptions.map(([name, meta]) => (
                  <SelectItem key={name} value={name} className="text-xs">{meta.string || name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={row.operator} onValueChange={v => updateRow(row.id, { operator: v as ComparisonOperator })}>
              <SelectTrigger className="h-8 w-32 rounded-lg text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {applicableOps.map(op => (
                  <SelectItem key={op.value} value={op.value} className="text-xs">{op.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {fieldMeta?.selection ? (
              <Select value={row.value} onValueChange={v => updateRow(row.id, { value: v })}>
                <SelectTrigger className="h-8 flex-1 rounded-lg text-xs">
                  <SelectValue placeholder="Value..." />
                </SelectTrigger>
                <SelectContent>
                  {fieldMeta.selection.map(([k, v]: [string, string]) => (
                    <SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                value={row.value}
                onChange={e => updateRow(row.id, { value: e.target.value })}
                placeholder="Value..."
                className="h-8 flex-1 rounded-lg text-xs"
                type={
                  fieldMeta?.type === 'integer' || fieldMeta?.type === 'float' ? 'number'
                  : fieldMeta?.type === 'date' ? 'date'
                  : 'text'
                }
              />
            )}

            <button onClick={() => removeRow(row.id)} className="rounded-lg p-1 text-muted-foreground hover:text-destructive transition-colors">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )
      })}

      <Button variant="ghost" size="sm" onClick={addRow} className="gap-1.5 text-xs text-muted-foreground">
        <Plus className="h-3 w-3" /> Add condition
      </Button>
    </div>
  )
}
