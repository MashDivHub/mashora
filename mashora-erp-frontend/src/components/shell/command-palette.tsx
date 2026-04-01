import { useMemo, useState } from 'react'
import { ArrowRight, Search } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export interface CommandPaletteItem {
  id: number
  label: string
  description: string
  section: string
}

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  items: CommandPaletteItem[]
  onSelect: (item: CommandPaletteItem) => void
}

export function CommandPalette({ open, onOpenChange, items, onSelect }: CommandPaletteProps) {
  const [query, setQuery] = useState('')

  const filteredItems = useMemo(() => {
    if (!query.trim()) {
      return items.slice(0, 12)
    }
    const normalizedQuery = query.toLowerCase()
    return items
      .filter((item) =>
        [item.label, item.description, item.section].some((value) =>
          value.toLowerCase().includes(normalizedQuery)
        )
      )
      .slice(0, 12)
  }, [items, query])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle>Jump anywhere</DialogTitle>
          <DialogDescription>
            Search the ERP menu tree and switch modules without touching the legacy client.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search apps, menus, and actions..."
              className="pl-9"
            />
          </div>
        </div>

        <div className="max-h-[55vh] overflow-y-auto px-3 pb-3">
          {filteredItems.length ? (
            <div className="space-y-2">
              {filteredItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onSelect(item)
                    onOpenChange(false)
                    setQuery('')
                  }}
                  className={cn(
                    'flex w-full items-center justify-between gap-4 rounded-2xl border border-transparent px-3 py-3 text-left transition',
                    'hover:border-primary/20 hover:bg-accent/60'
                  )}
                >
                  <div className="space-y-1">
                    <div className="font-medium">{item.label}</div>
                    <div className="text-sm text-muted-foreground">{item.description}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">{item.section}</Badge>
                    <ArrowRight className="size-4 text-muted-foreground" />
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="px-3 pb-4 text-sm text-muted-foreground">
              No matching menus yet. Try the app name, model area, or submenu label.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
