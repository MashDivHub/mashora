import { useState, useCallback, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
  Button, Checkbox, Skeleton, cn,
} from '@mashora/design-system'
import { ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight } from 'lucide-react'

/* ── Column Definition ── */
export interface Column<T = any> {
  key: string
  label: string
  sortable?: boolean
  align?: 'left' | 'center' | 'right'
  width?: string
  className?: string
  /** Custom render function. Receives row data + cell value */
  render?: (value: any, row: T) => ReactNode
  /** If no custom render, format the raw value */
  format?: (value: any) => string
}

/* ── Props ── */
export interface DataTableProps<T = Record<string, any>> {
  columns: Column<T>[]
  data: T[]
  total?: number
  page?: number
  pageSize?: number
  onPageChange?: (page: number) => void
  sortField?: string | null
  sortDir?: 'asc' | 'desc'
  onSort?: (field: string, dir: 'asc' | 'desc') => void
  loading?: boolean
  emptyMessage?: string
  emptyIcon?: ReactNode
  /** Row click handler — receives the row data */
  onRowClick?: (row: T) => void
  /** Navigate to this path on row click (uses row.id) */
  rowLink?: (row: T) => string
  /** Enable row selection checkboxes */
  selectable?: boolean
  selectedIds?: Set<number>
  onSelectionChange?: (ids: Set<number>) => void
  /** Row key extractor — defaults to row.id */
  rowKey?: (row: T) => string | number
  /** Extra class on the wrapper */
  className?: string
}

export default function DataTable<T extends Record<string, any> = Record<string, any>>({
  columns,
  data,
  total,
  page = 0,
  pageSize = 40,
  onPageChange,
  sortField,
  sortDir = 'asc',
  onSort,
  loading,
  emptyMessage = 'No records found',
  emptyIcon,
  onRowClick,
  rowLink,
  selectable,
  selectedIds,
  onSelectionChange,
  rowKey = (r) => r.id,
  className,
}: DataTableProps<T>) {
  const navigate = useNavigate()
  const recordTotal = total ?? data.length
  const totalPages = Math.max(1, Math.ceil(recordTotal / pageSize))
  const allSelected = data.length > 0 && data.every(r => selectedIds?.has(rowKey(r) as number))

  const handleSort = useCallback((field: string) => {
    if (!onSort) return
    if (sortField === field) {
      onSort(field, sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      onSort(field, 'asc')
    }
  }, [onSort, sortField, sortDir])

  const toggleAll = useCallback(() => {
    if (!onSelectionChange) return
    if (allSelected) {
      onSelectionChange(new Set())
    } else {
      onSelectionChange(new Set(data.map(r => rowKey(r) as number)))
    }
  }, [onSelectionChange, allSelected, data, rowKey])

  const toggleRow = useCallback((id: number) => {
    if (!onSelectionChange || !selectedIds) return
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id); else next.add(id)
    onSelectionChange(next)
  }, [onSelectionChange, selectedIds])

  const handleRowClick = useCallback((row: T) => {
    if (rowLink) {
      navigate(rowLink(row))
    } else if (onRowClick) {
      onRowClick(row)
    }
  }, [navigate, rowLink, onRowClick])

  const isClickable = !!(rowLink || onRowClick)

  return (
    <div className={cn('rounded-2xl border border-border/60 bg-card overflow-hidden', className)}>
      {loading ? (
        <div className="p-4 space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-lg" />
          ))}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-border/40">
                  {selectable && (
                    <TableHead className="w-10 h-10">
                      <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
                    </TableHead>
                  )}
                  {columns.map(col => (
                    <TableHead
                      key={col.key}
                      className={cn(
                        'h-10 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 select-none',
                        col.sortable !== false && onSort && 'cursor-pointer hover:text-foreground transition-colors',
                        col.align === 'right' && 'text-right',
                        col.align === 'center' && 'text-center',
                        col.className,
                      )}
                      style={col.width ? { width: col.width } : undefined}
                      onClick={() => col.sortable !== false && onSort && handleSort(col.key)}
                    >
                      <div className={cn('flex items-center gap-1', col.align === 'right' && 'justify-end')}>
                        {col.label}
                        {col.sortable !== false && onSort && (
                          sortField === col.key
                            ? sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                            : <ChevronsUpDown className="h-3 w-3 opacity-20" />
                        )}
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={columns.length + (selectable ? 1 : 0)} className="h-32 text-center text-muted-foreground">
                      {emptyIcon && <div className="mb-2 flex justify-center">{emptyIcon}</div>}
                      {emptyMessage}
                    </TableCell>
                  </TableRow>
                ) : (
                  data.map((row, ri) => {
                    const key = rowKey(row)
                    const selected = selectedIds?.has(key as number)
                    return (
                      <TableRow
                        key={key}
                        className={cn(
                          'border-border/30 transition-colors',
                          isClickable && 'cursor-pointer hover:bg-muted/20',
                          selected && 'bg-primary/5',
                        )}
                        onClick={() => isClickable && handleRowClick(row)}
                      >
                        {selectable && (
                          <TableCell className="w-10" onClick={e => e.stopPropagation()}>
                            <Checkbox checked={selected} onCheckedChange={() => toggleRow(key as number)} />
                          </TableCell>
                        )}
                        {columns.map((col, ci) => (
                          <TableCell
                            key={col.key}
                            className={cn(
                              'py-2.5 text-sm',
                              ci === 0 && 'font-medium',
                              col.align === 'right' && 'text-right tabular-nums',
                              col.align === 'center' && 'text-center',
                              col.className,
                            )}
                          >
                            {col.render
                              ? col.render(row[col.key], row)
                              : col.format
                                ? col.format(row[col.key])
                                : defaultFormat(row[col.key])}
                          </TableCell>
                        ))}
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {onPageChange && (
            <div className="flex items-center justify-between border-t border-border/40 px-4 py-2 text-sm text-muted-foreground">
              <span>
                {recordTotal > 0
                  ? `${page * pageSize + 1}–${Math.min((page + 1) * pageSize, recordTotal)} of ${recordTotal}`
                  : '0 records'}
              </span>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 rounded-lg" disabled={page === 0} onClick={() => onPageChange(page - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="px-2 text-xs tabular-nums">{totalPages > 0 ? `${page + 1} / ${totalPages}` : '—'}</span>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 rounded-lg" disabled={page >= totalPages - 1} onClick={() => onPageChange(page + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

/* ── Default formatting ── */
function defaultFormat(value: any): string {
  if (value === null || value === undefined || value === false) return ''
  if (Array.isArray(value)) return value[1] ?? String(value[0] ?? '')
  return String(value)
}
