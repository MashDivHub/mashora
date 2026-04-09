import { useState, useEffect, useRef } from 'react'
import { Button, Input } from '@mashora/design-system'
import { Star, Trash2, Plus } from 'lucide-react'
import type { SearchFavorite } from './SearchController'

interface FavoritesMenuProps {
  favorites: SearchFavorite[]
  onLoad: (fav: SearchFavorite) => void
  onDelete: (favId: string) => void
  onSave: (name: string) => void
  onClose: () => void
}

export default function FavoritesMenu({ favorites, onLoad, onDelete, onSave, onClose }: FavoritesMenuProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  const handleSave = () => {
    if (newName.trim()) {
      onSave(newName.trim())
      setNewName('')
      setAdding(false)
    }
  }

  return (
    <div ref={ref} className="absolute right-0 top-full z-50 mt-1 w-64 rounded-xl border bg-popover shadow-lg overflow-hidden">
      <div className="border-b border-border/70 bg-muted/20 px-3 py-2 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Favorites</p>
        <button onClick={() => setAdding(!adding)} className="rounded-lg p-1 hover:bg-accent transition-colors">
          <Plus className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>

      {adding && (
        <div className="border-b border-border/70 p-2 flex gap-1.5">
          <Input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Favorite name..."
            className="h-8 rounded-lg text-xs"
            onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
            autoFocus
          />
          <Button size="sm" onClick={handleSave} className="h-8 rounded-lg px-2 text-xs">Save</Button>
        </div>
      )}

      <div className="max-h-48 overflow-y-auto p-1">
        {favorites.length === 0 ? (
          <p className="px-3 py-4 text-center text-xs text-muted-foreground">No saved favorites</p>
        ) : (
          favorites.map(fav => (
            <div key={fav.id} className="flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-accent transition-colors group">
              <Star className="h-3.5 w-3.5 text-amber-500 shrink-0" />
              <button onClick={() => { onLoad(fav); onClose() }} className="flex-1 text-left text-sm truncate">
                {fav.name}
              </button>
              <button
                onClick={() => onDelete(fav.id)}
                className="opacity-0 group-hover:opacity-100 rounded p-0.5 hover:bg-destructive/10 transition-all"
              >
                <Trash2 className="h-3 w-3 text-destructive" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
