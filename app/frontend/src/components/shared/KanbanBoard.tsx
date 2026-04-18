import { useState } from 'react'
import { Card, CardContent, Badge, cn } from '@mashora/design-system'
import type { ReactNode } from 'react'

export interface KanbanColumn {
  id: string | number
  title: string
  count?: number
  color?: string
  fold?: boolean
}

export interface KanbanCardData {
  id: number
  columnId: string | number
  title: string
  subtitle?: string
  body?: ReactNode
  badges?: { label: string; variant?: 'default' | 'success' | 'warning' | 'destructive' | 'info' | 'secondary' | 'outline' }[]
  avatar?: string  // initials or image src
  priority?: number  // 0-3
  onClick?: () => void
}

interface KanbanBoardProps {
  columns: KanbanColumn[]
  cards: KanbanCardData[]
  onCardMove?: (cardId: number, fromCol: string | number, toCol: string | number) => void
  emptyState?: ReactNode
  className?: string
}

export default function KanbanBoard({ columns, cards, onCardMove, emptyState, className }: KanbanBoardProps) {
  const [draggingId, setDraggingId] = useState<number | null>(null)
  const [dragOverCol, setDragOverCol] = useState<string | number | null>(null)

  function handleDrop(toCol: string | number, e: React.DragEvent) {
    e.preventDefault()
    setDragOverCol(null)
    const cardId = Number(e.dataTransfer.getData('text/plain'))
    if (!cardId) return
    const card = cards.find(c => c.id === cardId)
    if (!card || card.columnId === toCol) return
    onCardMove?.(cardId, card.columnId, toCol)
    setDraggingId(null)
  }

  if (cards.length === 0 && emptyState) return <div className="py-8">{emptyState}</div>

  return (
    <div className={cn('flex gap-3 overflow-x-auto pb-4 -mx-1 px-1', className)}>
      {columns.map(col => {
        const colCards = cards.filter(c => c.columnId === col.id)
        return (
          <div
            key={col.id}
            className={cn(
              'flex-shrink-0 w-72 rounded-2xl border border-border/50 bg-muted/20 p-2 transition-colors',
              dragOverCol === col.id && 'ring-2 ring-primary/40 bg-accent/20',
              col.fold && 'w-12'
            )}
            onDragOver={e => { e.preventDefault(); setDragOverCol(col.id) }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverCol(null)
            }}
            onDrop={e => handleDrop(col.id, e)}
          >
            <div className="flex items-center justify-between px-2 py-1.5 mb-1">
              <h3 className="text-xs font-semibold uppercase tracking-wider truncate" style={col.color ? { color: col.color } : undefined}>
                {col.title}
              </h3>
              <Badge variant="secondary" className="text-[10px] rounded-full shrink-0">{col.count ?? colCards.length}</Badge>
            </div>
            <div className="flex flex-col gap-2">
              {colCards.map(card => (
                <Card
                  key={card.id}
                  draggable={!!onCardMove}
                  onDragStart={e => { setDraggingId(card.id); e.dataTransfer.setData('text/plain', String(card.id)) }}
                  onDragEnd={() => setDraggingId(null)}
                  className={cn(
                    'rounded-xl cursor-pointer hover:shadow-md transition-all',
                    draggingId === card.id && 'opacity-50',
                    onCardMove && 'cursor-grab active:cursor-grabbing'
                  )}
                  onClick={card.onClick}
                >
                  <CardContent className="p-3">
                    {card.priority != null && card.priority > 0 && (
                      <div className="flex gap-0.5 mb-1.5">
                        {Array.from({ length: card.priority }).map((_, i) => (
                          <div key={i} className="size-1.5 rounded-full bg-amber-400" />
                        ))}
                      </div>
                    )}
                    <p className="text-sm font-medium line-clamp-2">{card.title}</p>
                    {card.subtitle && <p className="text-xs text-muted-foreground mt-0.5">{card.subtitle}</p>}
                    {card.body && <div className="mt-2">{card.body}</div>}
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex flex-wrap gap-1">
                        {card.badges?.map((b, i) => (
                          <Badge key={i} variant={b.variant || 'secondary'} className="text-[10px] rounded-full">{b.label}</Badge>
                        ))}
                      </div>
                      {card.avatar && (
                        <div className="size-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-semibold">
                          {card.avatar.length <= 3 ? card.avatar : card.avatar[0]}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
              {colCards.length === 0 && (
                <p className="text-center text-xs text-muted-foreground py-4">No items</p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
