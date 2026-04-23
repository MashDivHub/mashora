import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Button, Input, Label, Skeleton, Switch,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  cn,
} from '@mashora/design-system'
import {
  Layout, Users, Circle, Square, Plus, Trash2, Copy, Check,
  ChevronDown, MapPin, Palette, Settings, ArrowLeft, Monitor,
} from 'lucide-react'
import { ConfirmDialog, toast } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'

// ── types ─────────────────────────────────────────────────────────────────────

interface RestaurantTable {
  id: number
  name: string
  floor_id?: number | [number, string] | false | null
  position_h?: number
  position_v?: number
  width?: number
  height?: number
  shape?: string
  seats?: number
  color?: string | null
  active?: boolean
}

interface RestaurantFloor {
  id: number
  name: string
  pos_config_id?: number | [number, string] | false | null
  sequence?: number
  background_color?: string | null
  tables?: RestaurantTable[]
}

interface PosConfigRow {
  id: number
  name: string
}

interface ListResponse<T> {
  records: T[]
  total: number
}

type TableStatus = 'available' | 'occupied' | 'reserved'

interface HistoryEntry {
  tableId: number
  position_h: number
  position_v: number
}

// ── constants ─────────────────────────────────────────────────────────────────

const CANVAS_WIDTH = 1200
const CANVAS_HEIGHT = 800
const HISTORY_MAX = 20
const DEFAULT_TABLE_COLOR = '#bae6fd'

const TABLE_COLOR_SWATCHES = [
  '#fecaca', // red
  '#fed7aa', // orange
  '#fde68a', // yellow
  '#bbf7d0', // green
  '#bae6fd', // sky
  '#c7d2fe', // indigo
  '#f5d0fe', // fuchsia
  '#e5e7eb', // slate
]

const FLOOR_BG_SWATCHES = [
  '#ffffff',
  '#f8fafc',
  '#f1f5f9',
  '#fef3c7',
  '#ecfccb',
  '#cffafe',
  '#dbeafe',
  '#fce7f3',
]

const DEFAULT_TABLE: Partial<RestaurantTable> = {
  position_h: 100,
  position_v: 100,
  width: 80,
  height: 80,
  shape: 'square',
  seats: 4,
  color: DEFAULT_TABLE_COLOR,
}

const STATUS_COLORS: Record<TableStatus, string> = {
  available: 'bg-emerald-500',
  occupied: 'bg-amber-500',
  reserved: 'bg-rose-500',
}

// ── helpers ───────────────────────────────────────────────────────────────────

function num(v: unknown, fallback = 0): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

function lightenColor(hex: string, amount = 0.2): string {
  // Simple blend toward white
  const h = hex.replace('#', '')
  if (h.length !== 6) return hex
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  const mix = (c: number) => Math.round(c + (255 - c) * amount)
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`
}

function darkenColor(hex: string, amount = 0.12): string {
  const h = hex.replace('#', '')
  if (h.length !== 6) return hex
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  const mix = (c: number) => Math.round(c * (1 - amount))
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`
}

// ── component ────────────────────────────────────────────────────────────────

export default function PosRestaurant() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const urlConfigId = searchParams.get('config_id')
  const qc = useQueryClient()

  const [editMode, setEditMode] = useState(false)
  const [activeFloorId, setActiveFloorId] = useState<number | null>(null)
  const [selectedTableId, setSelectedTableId] = useState<number | null>(null)

  // Local position overrides while dragging (optimistic UI)
  const [dragOverrides, setDragOverrides] = useState<Record<number, { position_h: number; position_v: number }>>({})

  // Undo/redo history for positions
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [redoStack, setRedoStack] = useState<HistoryEntry[]>([])

  // New-floor dialog
  const [newFloorOpen, setNewFloorOpen] = useState(false)
  const [newFloorName, setNewFloorName] = useState('')
  const [newFloorBg, setNewFloorBg] = useState(FLOOR_BG_SWATCHES[0])

  // Delete-floor confirmation
  const [deleteFloorOpen, setDeleteFloorOpen] = useState(false)

  // Delete-table confirmation
  const [deleteTableOpen, setDeleteTableOpen] = useState(false)

  // Mobile sidebar drawer state
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)

  // ── queries ──────────────────────────────────────────────────────────────

  const { data: configsResp } = useQuery<ListResponse<PosConfigRow>>({
    queryKey: ['pos-configs'],
    queryFn: () => erpClient.raw.get('/pos/configs').then(r => r.data),
    staleTime: 60_000,
  })

  const configs = configsResp?.records ?? []
  const configId = urlConfigId
    ? Number(urlConfigId)
    : configs[0]?.id ?? null

  const {
    data: floorsResp,
    isLoading: floorsLoading,
  } = useQuery<ListResponse<RestaurantFloor>>({
    queryKey: ['pos-floors', configId],
    queryFn: () => {
      const qs = configId ? `?config_id=${configId}` : ''
      return erpClient.raw.get(`/pos/floors${qs}`).then(r => r.data)
    },
    enabled: configId != null,
  })

  const floors = floorsResp?.records ?? []

  useEffect(() => {
    if (floors.length === 0) {
      if (activeFloorId !== null) setActiveFloorId(null)
      return
    }
    if (activeFloorId == null || !floors.some(f => f.id === activeFloorId)) {
      setActiveFloorId(floors[0].id)
    }
  }, [floors, activeFloorId])

  const {
    data: activeFloor,
    isLoading: floorLoading,
  } = useQuery<RestaurantFloor>({
    queryKey: ['pos-floor-detail', activeFloorId],
    queryFn: () => erpClient.raw.get(`/pos/floors/${activeFloorId}`).then(r => r.data),
    enabled: activeFloorId != null,
  })

  const tables: RestaurantTable[] = useMemo(() => {
    const src = activeFloor?.tables ?? []
    // Merge with drag overrides for optimistic UI
    return src.map(t => {
      const o = dragOverrides[t.id]
      return o ? { ...t, position_h: o.position_h, position_v: o.position_v } : t
    })
  }, [activeFloor, dragOverrides])

  const selectedTable = useMemo(
    () => tables.find(t => t.id === selectedTableId) || null,
    [tables, selectedTableId],
  )

  // Clear drag overrides when floor changes
  useEffect(() => {
    setDragOverrides({})
    setHistory([])
    setRedoStack([])
  }, [activeFloorId])

  // ── mutations ────────────────────────────────────────────────────────────

  const invalidateFloor = useCallback((fid: number | null) => {
    qc.invalidateQueries({ queryKey: ['pos-floors', configId] })
    if (fid != null) qc.invalidateQueries({ queryKey: ['pos-floor-detail', fid] })
  }, [qc, configId])

  const createFloorMut = useMutation({
    mutationFn: (vals: Record<string, unknown>) =>
      erpClient.raw.post('/pos/floors', vals).then(r => r.data),
    onSuccess: (data: RestaurantFloor) => {
      setNewFloorName('')
      setNewFloorBg(FLOOR_BG_SWATCHES[0])
      setNewFloorOpen(false)
      qc.invalidateQueries({ queryKey: ['pos-floors', configId] })
      if (data?.id) setActiveFloorId(data.id)
      toast.success('Floor created')
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Failed to create floor'),
  })

  const updateFloorMut = useMutation({
    mutationFn: ({ id, vals }: { id: number; vals: Record<string, unknown> }) =>
      erpClient.raw.put(`/pos/floors/${id}`, vals).then(r => r.data),
    onSuccess: () => invalidateFloor(activeFloorId),
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Failed to update floor'),
  })

  const deleteFloorMut = useMutation({
    mutationFn: (id: number) => erpClient.raw.delete(`/pos/floors/${id}`).then(r => r.data),
    onSuccess: () => {
      setDeleteFloorOpen(false)
      setActiveFloorId(null)
      qc.invalidateQueries({ queryKey: ['pos-floors', configId] })
      toast.success('Floor deleted')
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Failed to delete floor'),
  })

  const createTableMut = useMutation({
    mutationFn: (vals: Record<string, unknown>) =>
      erpClient.raw.post('/pos/tables', vals).then(r => r.data),
    onSuccess: (row: RestaurantTable) => {
      invalidateFloor(activeFloorId)
      if (row?.id) setSelectedTableId(row.id)
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Failed to add table'),
  })

  const updateTableMut = useMutation({
    mutationFn: ({ id, vals }: { id: number; vals: Record<string, unknown> }) =>
      erpClient.raw.put(`/pos/tables/${id}`, vals).then(r => r.data),
    onSuccess: (_data, variables) => {
      invalidateFloor(activeFloorId)
      // Clear drag override once persisted
      setDragOverrides(prev => {
        if (!(variables.id in prev)) return prev
        const next = { ...prev }
        delete next[variables.id]
        return next
      })
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Failed to update table'),
  })

  const deleteTableMut = useMutation({
    mutationFn: (id: number) => erpClient.raw.delete(`/pos/tables/${id}`).then(r => r.data),
    onSuccess: () => {
      setDeleteTableOpen(false)
      setSelectedTableId(null)
      invalidateFloor(activeFloorId)
      toast.success('Table deleted')
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Failed to delete table'),
  })

  // ── handlers ─────────────────────────────────────────────────────────────

  function handleCreateFloor() {
    if (!newFloorName.trim()) return
    const vals: Record<string, unknown> = {
      name: newFloorName.trim(),
      background_color: newFloorBg,
    }
    if (configId) vals.pos_config_id = configId
    createFloorMut.mutate(vals)
  }

  function handleAddTable() {
    if (activeFloorId == null) return
    const existing = tables.length
    createTableMut.mutate({
      floor_id: activeFloorId,
      name: `T${existing + 1}`,
      ...DEFAULT_TABLE,
    })
  }

  function duplicateTable(t: RestaurantTable) {
    if (activeFloorId == null) return
    createTableMut.mutate({
      floor_id: activeFloorId,
      name: `${t.name} copy`,
      position_h: num(t.position_h) + 20,
      position_v: num(t.position_v) + 20,
      width: t.width ?? 80,
      height: t.height ?? 80,
      shape: t.shape ?? 'square',
      seats: t.seats ?? 4,
      color: t.color ?? DEFAULT_TABLE_COLOR,
    })
  }

  function patchSelectedTable(patch: Partial<RestaurantTable>) {
    if (!selectedTable) return
    updateTableMut.mutate({ id: selectedTable.id, vals: patch as Record<string, unknown> })
  }

  // ── drag-to-move ─────────────────────────────────────────────────────────

  const canvasInnerRef = useRef<HTMLDivElement | null>(null)
  const dragStateRef = useRef<{
    tableId: number
    offsetX: number
    offsetY: number
    width: number
    height: number
    startX: number
    startY: number
    moved: boolean
    altKey: boolean
    origin: { position_h: number; position_v: number }
  } | null>(null)

  const pushHistory = useCallback((entry: HistoryEntry) => {
    setHistory(prev => {
      const next = [...prev, entry]
      if (next.length > HISTORY_MAX) next.shift()
      return next
    })
    setRedoStack([])
  }, [])

  const onTablePointerDown = (e: ReactPointerEvent<HTMLDivElement>, table: RestaurantTable) => {
    if (!editMode) return
    // Only primary button
    if (e.button !== 0) return
    e.stopPropagation()
    const canvas = canvasInnerRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.offsetWidth ? rect.width / canvas.offsetWidth : 1
    const scaleY = canvas.offsetHeight ? rect.height / canvas.offsetHeight : 1
    const w = num(table.width, 80)
    const h = num(table.height, 80)
    const posH = num(table.position_h)
    const posV = num(table.position_v)
    const localX = (e.clientX - rect.left) / scaleX
    const localY = (e.clientY - rect.top) / scaleY
    dragStateRef.current = {
      tableId: table.id,
      offsetX: localX - posH,
      offsetY: localY - posV,
      width: w,
      height: h,
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
      altKey: e.altKey,
      origin: { position_h: posH, position_v: posV },
    }
    setSelectedTableId(table.id)
    try { (e.target as Element).setPointerCapture?.(e.pointerId) } catch {
      // ignore
    }
  }

  const onCanvasPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const st = dragStateRef.current
    if (!st) return
    const canvas = canvasInnerRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.offsetWidth ? rect.width / canvas.offsetWidth : 1
    const scaleY = canvas.offsetHeight ? rect.height / canvas.offsetHeight : 1
    const localX = (e.clientX - rect.left) / scaleX
    const localY = (e.clientY - rect.top) / scaleY
    const rawH = localX - st.offsetX
    const rawV = localY - st.offsetY
    const nextH = Math.round(clamp(rawH, 0, CANVAS_WIDTH - st.width))
    const nextV = Math.round(clamp(rawV, 0, CANVAS_HEIGHT - st.height))
    const dx = Math.abs(e.clientX - st.startX)
    const dy = Math.abs(e.clientY - st.startY)
    if (!st.moved && (dx > 3 || dy > 3)) st.moved = true
    if (st.moved) {
      setDragOverrides(prev => ({
        ...prev,
        [st.tableId]: { position_h: nextH, position_v: nextV },
      }))
    }
  }

  const onCanvasPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const st = dragStateRef.current
    dragStateRef.current = null
    if (!st) return
    try { (e.target as Element).releasePointerCapture?.(e.pointerId) } catch {
      // ignore
    }
    if (!st.moved) return
    const over = dragOverridesRef.current[st.tableId]
    if (!over) return
    // Alt+drag => duplicate at new position, revert original
    if (st.altKey) {
      setDragOverrides(prev => {
        const next = { ...prev }
        delete next[st.tableId]
        return next
      })
      const original = tablesRef.current.find(t => t.id === st.tableId)
      if (original && activeFloorId != null) {
        createTableMut.mutate({
          floor_id: activeFloorId,
          name: `${original.name} copy`,
          position_h: over.position_h,
          position_v: over.position_v,
          width: original.width ?? 80,
          height: original.height ?? 80,
          shape: original.shape ?? 'square',
          seats: original.seats ?? 4,
          color: original.color ?? DEFAULT_TABLE_COLOR,
        })
      }
      return
    }
    // Commit move to backend + push history
    pushHistory({ tableId: st.tableId, position_h: st.origin.position_h, position_v: st.origin.position_v })
    updateTableMut.mutate({
      id: st.tableId,
      vals: { position_h: over.position_h, position_v: over.position_v },
    })
  }

  // Keep refs in sync for handlers used in pointerUp (closure-safe)
  const dragOverridesRef = useRef(dragOverrides)
  const tablesRef = useRef(tables)
  useEffect(() => { dragOverridesRef.current = dragOverrides }, [dragOverrides])
  useEffect(() => { tablesRef.current = tables }, [tables])

  // ── keyboard shortcuts ───────────────────────────────────────────────────

  useEffect(() => {
    if (!editMode) return
    const onKey = (e: KeyboardEvent) => {
      const tgt = e.target as HTMLElement | null
      const isEditable =
        tgt && (
          tgt.tagName === 'INPUT' ||
          tgt.tagName === 'TEXTAREA' ||
          tgt.isContentEditable
        )
      if (isEditable) return

      // Delete / Backspace: delete selected table
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedTableId != null) {
        e.preventDefault()
        setDeleteTableOpen(true)
        return
      }

      // Undo
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        setHistory(prev => {
          if (prev.length === 0) return prev
          const last = prev[prev.length - 1]
          // Find current position (from override or from data)
          const cur = tablesRef.current.find(t => t.id === last.tableId)
          if (cur) {
            setRedoStack(r => {
              const next = [...r, {
                tableId: last.tableId,
                position_h: num(cur.position_h),
                position_v: num(cur.position_v),
              }]
              if (next.length > HISTORY_MAX) next.shift()
              return next
            })
          }
          setDragOverrides(prevOv => ({
            ...prevOv,
            [last.tableId]: { position_h: last.position_h, position_v: last.position_v },
          }))
          updateTableMut.mutate({
            id: last.tableId,
            vals: { position_h: last.position_h, position_v: last.position_v },
          })
          return prev.slice(0, -1)
        })
        return
      }

      // Redo (Ctrl+Y or Ctrl+Shift+Z)
      if (
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z')
      ) {
        e.preventDefault()
        setRedoStack(prev => {
          if (prev.length === 0) return prev
          const last = prev[prev.length - 1]
          const cur = tablesRef.current.find(t => t.id === last.tableId)
          if (cur) {
            setHistory(h => {
              const next = [...h, {
                tableId: last.tableId,
                position_h: num(cur.position_h),
                position_v: num(cur.position_v),
              }]
              if (next.length > HISTORY_MAX) next.shift()
              return next
            })
          }
          setDragOverrides(prevOv => ({
            ...prevOv,
            [last.tableId]: { position_h: last.position_h, position_v: last.position_v },
          }))
          updateTableMut.mutate({
            id: last.tableId,
            vals: { position_h: last.position_h, position_v: last.position_v },
          })
          return prev.slice(0, -1)
        })
        return
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editMode, selectedTableId, updateTableMut])

  // ── render: no config ────────────────────────────────────────────────────

  if (!configId && configs.length === 0) {
    return (
      <div className="mx-auto max-w-[1400px] px-6 py-6 space-y-6">
        <BreadcrumbRow />
        <div className="rounded-3xl border border-dashed border-border/60 bg-muted/20 p-12 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Monitor className="h-7 w-7" />
          </div>
          <h2 className="text-lg font-semibold">Set up a POS register first</h2>
          <p className="mt-1 text-sm text-muted-foreground max-w-md mx-auto">
            You need at least one POS configuration before you can design restaurant floors and tables.
          </p>
          <Button
            className="mt-5 rounded-xl gap-1.5"
            onClick={() => navigate('/admin/pos/config/new')}
          >
            <Plus className="h-4 w-4" /> New register
          </Button>
        </div>
      </div>
    )
  }

  // ── render: main ─────────────────────────────────────────────────────────

  const canvasBg = activeFloor?.background_color || '#ffffff'

  const hasFloors = floors.length > 0
  const hasTables = tables.length > 0
  const terminalHref = configId != null ? `/admin/pos/terminal/${configId}` : '/admin/pos'

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-6 space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <BreadcrumbRow />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate('/admin/pos')}
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Back"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <h1 className="text-2xl font-semibold tracking-tight">Restaurant Floors</h1>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Design your floor plan and manage tables
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'flex items-center gap-2 rounded-xl border border-border/40 bg-card px-3 py-1.5 transition-all duration-200',
                editMode ? 'ring-2 ring-primary/40' : ''
              )}
            >
              <Label htmlFor="edit-mode" className="text-xs font-medium text-muted-foreground">
                {editMode ? 'Edit mode' : 'Preview mode'}
              </Label>
              <Switch id="edit-mode" checked={editMode} onCheckedChange={(v) => {
                setEditMode(v)
                if (!v) setSelectedTableId(null)
              }} />
            </div>
            <Button
              onClick={() => navigate(terminalHref)}
              className="rounded-xl gap-2 bg-gradient-to-br from-primary to-primary/80"
            >
              <Monitor className="h-4 w-4" />
              Launch terminal
            </Button>
          </div>
        </div>
      </div>

      {/* Config selector (only if > 1 config) */}
      {configs.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground mr-2">
            Register
          </span>
          {configs.map(c => {
            const isActive = c.id === configId
            return (
              <button
                key={c.id}
                onClick={() => {
                  const sp = new URLSearchParams(searchParams)
                  sp.set('config_id', String(c.id))
                  navigate(`?${sp.toString()}`, { replace: true })
                }}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs font-medium transition-all duration-200',
                  isActive
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border/40 bg-card text-muted-foreground hover:bg-muted/40'
                )}
              >
                {c.name}
              </button>
            )
          })}
        </div>
      )}

      {/* Floor tabs */}
      {floorsLoading ? (
        <div className="flex gap-2">
          <Skeleton className="h-11 w-32 rounded-t-2xl" />
          <Skeleton className="h-11 w-32 rounded-t-2xl" />
          <Skeleton className="h-11 w-32 rounded-t-2xl" />
        </div>
      ) : !hasFloors ? (
        <div className="rounded-3xl border border-dashed border-border/60 bg-muted/20 p-12 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Layout className="h-7 w-7" />
          </div>
          <h2 className="text-lg font-semibold">No restaurant floors yet</h2>
          <p className="mt-1 text-sm text-muted-foreground max-w-md mx-auto">
            Create your first floor to start designing your restaurant layout.
          </p>
          <Button
            className="mt-5 rounded-xl gap-1.5 bg-gradient-to-br from-primary to-primary/80"
            onClick={() => setNewFloorOpen(true)}
          >
            <Plus className="h-4 w-4" /> Create first floor
          </Button>
        </div>
      ) : (
        <div className="-mb-px flex items-end gap-1 overflow-x-auto pb-0 scrollbar-thin">
          {floors.map(floor => {
            const isActive = floor.id === activeFloorId
            const tableCount = floor.tables?.length ?? (floor.id === activeFloorId ? tables.length : 0)
            return (
              <button
                key={floor.id}
                onClick={() => { setActiveFloorId(floor.id); setSelectedTableId(null) }}
                className={cn(
                  'group flex items-center gap-2 rounded-t-2xl border-b-0 px-4 py-2.5 text-sm font-medium transition-all duration-200 whitespace-nowrap',
                  isActive
                    ? 'bg-card border-t border-l border-r border-border/40 shadow-md text-foreground'
                    : 'bg-muted/30 border-t border-l border-r border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                )}
              >
                <span
                  className="h-2.5 w-2.5 rounded-full border border-black/10 shadow-sm"
                  style={{ background: floor.background_color || '#ffffff' }}
                />
                <span>{floor.name}</span>
                <span className={cn(
                  'rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                  isActive ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
                )}>
                  {tableCount}
                </span>
              </button>
            )
          })}
          <button
            onClick={() => setNewFloorOpen(true)}
            className="flex items-center gap-1 rounded-t-2xl border border-dashed border-border/60 bg-muted/20 px-3 py-2.5 text-xs text-muted-foreground hover:bg-muted/40 transition-all duration-200"
            aria-label="Add floor"
          >
            <Plus className="h-3.5 w-3.5" />
            New
          </button>
        </div>
      )}

      {/* Floor toolbar (edit mode only) */}
      {editMode && activeFloor && (
        <FloorToolbar
          floor={activeFloor}
          onRename={(name) => updateFloorMut.mutate({ id: activeFloor.id, vals: { name } })}
          onColor={(bg) => updateFloorMut.mutate({ id: activeFloor.id, vals: { background_color: bg } })}
          onDelete={() => setDeleteFloorOpen(true)}
          onAddTable={handleAddTable}
          busy={createTableMut.isPending}
        />
      )}

      {/* Canvas + sidebar */}
      {hasFloors && activeFloorId != null && (
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 min-w-0">
            {floorLoading ? (
              <Skeleton className="w-full h-[600px] rounded-2xl" />
            ) : (
              <div
                className="rounded-2xl border border-border/40 bg-card overflow-hidden shadow-inner relative min-h-[600px]"
              >
                <div className="overflow-auto max-h-[75vh]">
                  <div
                    ref={canvasInnerRef}
                    className="relative"
                    style={{
                      width: CANVAS_WIDTH,
                      height: CANVAS_HEIGHT,
                      background: canvasBg,
                      backgroundImage:
                        'linear-gradient(to right, rgba(15,23,42,0.06) 1px, transparent 1px), ' +
                        'linear-gradient(to bottom, rgba(15,23,42,0.06) 1px, transparent 1px)',
                      backgroundSize: '50px 50px',
                    }}
                    onPointerMove={onCanvasPointerMove}
                    onPointerUp={onCanvasPointerUp}
                    onPointerCancel={onCanvasPointerUp}
                    onClick={(ev) => {
                      if (ev.target === ev.currentTarget && editMode) {
                        setSelectedTableId(null)
                      }
                    }}
                  >
                    {!hasTables && (
                      <div className="absolute inset-0 flex items-center justify-center p-6 pointer-events-none">
                        <div className="rounded-2xl border-2 border-dashed border-border/60 bg-background/60 backdrop-blur-sm px-8 py-10 text-center max-w-md pointer-events-auto">
                          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                            <Square className="h-6 w-6" />
                          </div>
                          <p className="text-sm font-semibold">
                            {editMode ? 'Add your first table' : 'No tables on this floor yet'}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {editMode
                              ? 'Click below to drop a table onto the canvas.'
                              : 'Turn on Edit mode to start placing tables.'}
                          </p>
                          {editMode && (
                            <Button
                              size="sm"
                              onClick={handleAddTable}
                              className="mt-4 rounded-xl gap-1.5 bg-gradient-to-br from-primary to-primary/80"
                            >
                              <Plus className="h-4 w-4" /> Add table
                            </Button>
                          )}
                        </div>
                      </div>
                    )}

                    {tables.map(t => (
                      <TableNode
                        key={t.id}
                        table={t}
                        selected={t.id === selectedTableId}
                        editMode={editMode}
                        onPointerDown={(e) => onTablePointerDown(e, t)}
                        onClick={(e) => {
                          e.stopPropagation()
                          if (editMode) {
                            setSelectedTableId(t.id)
                            if (window.matchMedia('(max-width: 1023px)').matches) {
                              setMobileDrawerOpen(true)
                            }
                            return
                          }
                          if (configId != null) {
                            navigate(`/admin/pos/terminal/${configId}?table=${t.id}`)
                          }
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Desktop sidebar */}
          {editMode && selectedTable && (
            <div className="hidden lg:block">
              <TableSidebar
                table={selectedTable}
                onChange={patchSelectedTable}
                onDelete={() => setDeleteTableOpen(true)}
                onDuplicate={() => duplicateTable(selectedTable)}
                onDone={() => setSelectedTableId(null)}
                saving={updateTableMut.isPending}
              />
            </div>
          )}
        </div>
      )}

      {/* Mobile drawer for table editor */}
      {editMode && selectedTable && mobileDrawerOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/40" onClick={() => setMobileDrawerOpen(false)}>
          <div
            className="absolute bottom-0 left-0 right-0 max-h-[85vh] overflow-y-auto bg-background rounded-t-3xl border-t border-border shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 flex justify-center bg-background pt-3 pb-1">
              <div className="h-1.5 w-12 rounded-full bg-muted-foreground/30" />
            </div>
            <TableSidebar
              table={selectedTable}
              onChange={patchSelectedTable}
              onDelete={() => { setDeleteTableOpen(true); setMobileDrawerOpen(false) }}
              onDuplicate={() => { duplicateTable(selectedTable); setMobileDrawerOpen(false) }}
              onDone={() => { setSelectedTableId(null); setMobileDrawerOpen(false) }}
              saving={updateTableMut.isPending}
              fullWidth
            />
          </div>
        </div>
      )}

      {/* New floor dialog */}
      <Dialog open={newFloorOpen} onOpenChange={setNewFloorOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>New floor</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="new-floor-name">Floor name</Label>
              <Input
                id="new-floor-name"
                value={newFloorName}
                onChange={e => setNewFloorName(e.target.value)}
                placeholder="Main Dining"
                className="rounded-xl"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label>Background color</Label>
              <div className="flex flex-wrap gap-2">
                {FLOOR_BG_SWATCHES.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setNewFloorBg(c)}
                    aria-label={`Background ${c}`}
                    className={cn(
                      'h-8 w-8 rounded-full border transition-all duration-200 flex items-center justify-center',
                      newFloorBg === c
                        ? 'border-primary ring-2 ring-primary/40 scale-110'
                        : 'border-border/40 hover:scale-105'
                    )}
                    style={{ background: c }}
                  >
                    {newFloorBg === c && <Check className="h-4 w-4 text-primary drop-shadow" />}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => setNewFloorOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateFloor}
              disabled={!newFloorName.trim() || createFloorMut.isPending}
              className="rounded-xl bg-gradient-to-br from-primary to-primary/80"
            >
              {createFloorMut.isPending ? 'Creating…' : 'Create floor'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete floor confirm */}
      <ConfirmDialog
        open={deleteFloorOpen}
        onClose={() => setDeleteFloorOpen(false)}
        title="Delete floor?"
        message={`"${activeFloor?.name ?? ''}" and all of its tables will be permanently removed. This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        loading={deleteFloorMut.isPending}
        onConfirm={() => activeFloor && deleteFloorMut.mutate(activeFloor.id)}
      />

      {/* Delete table confirm */}
      <ConfirmDialog
        open={deleteTableOpen}
        onClose={() => setDeleteTableOpen(false)}
        title="Delete table?"
        message={selectedTable ? `Table "${selectedTable.name}" will be archived.` : ''}
        confirmLabel="Delete"
        variant="danger"
        loading={deleteTableMut.isPending}
        onConfirm={() => selectedTable && deleteTableMut.mutate(selectedTable.id)}
      />
    </div>
  )
}

// ── subcomponents ────────────────────────────────────────────────────────────

function BreadcrumbRow() {
  return (
    <nav className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <MapPin className="h-3 w-3" />
      <span>POS</span>
      <ChevronDown className="h-3 w-3 -rotate-90" />
      <span className="font-medium text-foreground">Restaurant Floors</span>
    </nav>
  )
}

interface TableNodeProps {
  table: RestaurantTable
  selected: boolean
  editMode: boolean
  onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => void
  onClick: (e: React.MouseEvent<HTMLDivElement>) => void
}

function TableNode({ table, selected, editMode, onPointerDown, onClick }: TableNodeProps) {
  const isRound = (table.shape || '').toLowerCase() === 'round'
  const baseColor = table.color || DEFAULT_TABLE_COLOR
  // Always "available" until backend provides status
  const status: TableStatus = 'available'
  const w = num(table.width, 80)
  const h = num(table.height, 80)

  const style: CSSProperties = {
    left: num(table.position_h),
    top: num(table.position_v),
    width: w,
    height: h,
    backgroundImage: `linear-gradient(135deg, ${lightenColor(baseColor, 0.15)}, ${darkenColor(baseColor, 0.08)})`,
    borderColor: darkenColor(baseColor, 0.2),
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onPointerDown={onPointerDown}
      onClick={onClick}
      title={editMode ? `Drag to move · ${table.name}` : `Click to start a new order at ${table.name}`}
      className={cn(
        'absolute group flex flex-col items-center justify-center select-none border-2 p-1 text-center transition-all duration-200',
        isRound ? 'rounded-full' : 'rounded-2xl',
        editMode ? 'cursor-move' : 'cursor-pointer',
        selected
          ? 'ring-4 ring-emerald-500 shadow-2xl z-10'
          : 'hover:ring-2 hover:ring-primary/60 hover:shadow-xl hover:-translate-y-0.5',
      )}
      style={style}
    >
      {/* Status dot */}
      <span
        className={cn(
          'absolute top-1.5 right-1.5 h-2 w-2 rounded-full ring-2 ring-white/80 shadow',
          STATUS_COLORS[status]
        )}
        aria-label={`Status: ${status}`}
      />

      <span
        className={cn(
          'font-bold truncate max-w-[90%] leading-tight',
          w < 60 ? 'text-[10px]' : 'text-xs'
        )}
        style={{ color: darkenColor(baseColor, 0.6) }}
      >
        {table.name}
      </span>
      <div
        className="flex items-center gap-0.5 mt-0.5 opacity-80"
        style={{ color: darkenColor(baseColor, 0.5) }}
      >
        <Users className={cn(w < 60 ? 'h-2.5 w-2.5' : 'h-3 w-3')} />
        <span className={cn('font-semibold', w < 60 ? 'text-[9px]' : 'text-[10px]')}>
          {table.seats ?? 0}
        </span>
      </div>
    </div>
  )
}

interface FloorToolbarProps {
  floor: RestaurantFloor
  onRename: (name: string) => void
  onColor: (bg: string) => void
  onDelete: () => void
  onAddTable: () => void
  busy?: boolean
}

function FloorToolbar({ floor, onRename, onColor, onDelete, onAddTable, busy }: FloorToolbarProps) {
  const [name, setName] = useState(floor.name)

  useEffect(() => { setName(floor.name) }, [floor.id, floor.name])

  return (
    <div className="rounded-2xl border border-border/40 bg-card px-4 py-3 flex flex-wrap items-center gap-4 shadow-sm">
      <div className="flex items-center gap-2 min-w-0">
        <Settings className="h-4 w-4 text-muted-foreground shrink-0" />
        <Input
          value={name}
          onChange={e => setName(e.target.value)}
          onBlur={() => {
            const trimmed = name.trim()
            if (trimmed && trimmed !== floor.name) onRename(trimmed)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
          }}
          className="h-9 w-52 rounded-xl"
          placeholder="Floor name"
        />
      </div>

      <div className="flex items-center gap-2">
        <Palette className="h-4 w-4 text-muted-foreground" />
        <div className="flex items-center gap-1">
          {FLOOR_BG_SWATCHES.map(c => (
            <button
              key={c}
              type="button"
              onClick={() => onColor(c)}
              aria-label={`Set background ${c}`}
              className={cn(
                'h-6 w-6 rounded-full border transition-all duration-200',
                (floor.background_color || '').toLowerCase() === c.toLowerCase()
                  ? 'ring-2 ring-primary ring-offset-1 scale-110'
                  : 'border-border/40 hover:scale-110'
              )}
              style={{ background: c }}
            />
          ))}
        </div>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <Button
          size="sm"
          onClick={onAddTable}
          disabled={busy}
          className="rounded-xl gap-1.5 bg-gradient-to-br from-primary to-primary/80"
        >
          <Plus className="h-3.5 w-3.5" /> Add table
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onDelete}
          className="rounded-xl gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10"
        >
          <Trash2 className="h-3.5 w-3.5" /> Delete floor
        </Button>
      </div>
    </div>
  )
}

interface TableSidebarProps {
  table: RestaurantTable
  onChange: (patch: Partial<RestaurantTable>) => void
  onDelete: () => void
  onDuplicate: () => void
  onDone: () => void
  saving?: boolean
  fullWidth?: boolean
}

function TableSidebar({
  table, onChange, onDelete, onDuplicate, onDone, saving, fullWidth,
}: TableSidebarProps) {
  const [name, setName] = useState(table.name)
  const [seats, setSeats] = useState(String(table.seats ?? 1))
  const [width, setWidth] = useState(String(table.width ?? 80))
  const [height, setHeight] = useState(String(table.height ?? 80))
  const [posH, setPosH] = useState(String(table.position_h ?? 0))
  const [posV, setPosV] = useState(String(table.position_v ?? 0))

  useEffect(() => {
    setName(table.name)
    setSeats(String(table.seats ?? 1))
    setWidth(String(table.width ?? 80))
    setHeight(String(table.height ?? 80))
    setPosH(String(table.position_h ?? 0))
    setPosV(String(table.position_v ?? 0))
  }, [table.id, table.name, table.seats, table.width, table.height, table.position_h, table.position_v])

  const shape = (table.shape || 'square').toLowerCase()

  return (
    <aside
      className={cn(
        'rounded-2xl border border-border/40 bg-card p-6 flex-shrink-0 self-start shadow-sm space-y-5',
        fullWidth ? 'w-full rounded-b-none' : 'w-80 lg:w-96'
      )}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Editing
          </p>
          <p className="text-base font-semibold truncate">{table.name}</p>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={onDone}
          className="rounded-xl"
          aria-label="Done"
        >
          <Check className="h-4 w-4" />
        </Button>
      </div>

      {/* Table properties */}
      <div className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Table properties
        </p>

        <div className="space-y-1.5">
          <Label htmlFor="t-name">Name</Label>
          <Input
            id="t-name"
            value={name}
            onChange={e => setName(e.target.value)}
            onBlur={() => {
              const trimmed = name.trim()
              if (trimmed && trimmed !== table.name) onChange({ name: trimmed })
            }}
            className="rounded-xl"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="t-seats">Seats</Label>
          <Input
            id="t-seats"
            type="number"
            min={1}
            value={seats}
            onChange={e => setSeats(e.target.value)}
            onBlur={() => {
              const n = Math.max(1, Math.floor(num(seats, 1)))
              if (n !== table.seats) onChange({ seats: n })
            }}
            className="rounded-xl"
          />
        </div>

        <div className="space-y-1.5">
          <Label>Shape</Label>
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted/50 p-1">
            {(['square', 'round'] as const).map(s => (
              <button
                key={s}
                type="button"
                onClick={() => onChange({ shape: s })}
                className={cn(
                  'flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200',
                  shape === s
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {s === 'square' ? <Square className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Color</Label>
          <div className="flex flex-wrap gap-2">
            {TABLE_COLOR_SWATCHES.map(c => {
              const active = (table.color || '').toLowerCase() === c.toLowerCase()
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => onChange({ color: c })}
                  aria-label={`Color ${c}`}
                  className={cn(
                    'h-8 w-8 rounded-full border transition-all duration-200 flex items-center justify-center',
                    active
                      ? 'border-primary ring-2 ring-primary/40 scale-110'
                      : 'border-border/40 hover:scale-110'
                  )}
                  style={{ background: c }}
                >
                  {active && <Check className="h-3.5 w-3.5 text-primary drop-shadow" />}
                </button>
              )
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="t-width">Width</Label>
            <Input
              id="t-width"
              type="number"
              min={30}
              max={200}
              value={width}
              onChange={e => setWidth(e.target.value)}
              onBlur={() => {
                const n = clamp(Math.floor(num(width, 80)), 30, 200)
                if (n !== table.width) onChange({ width: n })
              }}
              className="rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="t-height">Height</Label>
            <Input
              id="t-height"
              type="number"
              min={30}
              max={200}
              value={height}
              onChange={e => setHeight(e.target.value)}
              onBlur={() => {
                const n = clamp(Math.floor(num(height, 80)), 30, 200)
                if (n !== table.height) onChange({ height: n })
              }}
              className="rounded-xl"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="t-x">X</Label>
            <Input
              id="t-x"
              type="number"
              value={posH}
              onChange={e => setPosH(e.target.value)}
              onBlur={() => {
                const n = Math.max(0, Math.floor(num(posH, 0)))
                if (n !== table.position_h) onChange({ position_h: n })
              }}
              className="rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="t-y">Y</Label>
            <Input
              id="t-y"
              type="number"
              value={posV}
              onChange={e => setPosV(e.target.value)}
              onBlur={() => {
                const n = Math.max(0, Math.floor(num(posV, 0)))
                if (n !== table.position_v) onChange({ position_v: n })
              }}
              className="rounded-xl"
            />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-2 pt-2 border-t border-border/40">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground pt-3">
          Actions
        </p>
        <Button
          variant="outline"
          onClick={onDuplicate}
          className="w-full rounded-xl gap-1.5"
          disabled={saving}
        >
          <Copy className="h-3.5 w-3.5" />
          Duplicate table
        </Button>
        <Button
          variant="outline"
          onClick={onDelete}
          className="w-full rounded-xl gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10"
          disabled={saving}
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete table
        </Button>
        <Button
          onClick={onDone}
          className="w-full rounded-xl bg-gradient-to-br from-primary to-primary/80"
        >
          Done
        </Button>
      </div>
    </aside>
  )
}
