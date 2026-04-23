import { forwardRef, useEffect, useRef } from 'react'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
  DropdownMenuLabel,
} from '@mashora/design-system'
import { ArrowLeft, Search, X, MoreVertical, Wifi, WifiOff, LogOut, Armchair, Settings, DoorClosed } from 'lucide-react'
import { PosOfflineBadge } from '@/components/shared'

interface TerminalHeaderProps {
  registerName?: string
  sessionName?: string
  online: boolean
  search: string
  onSearchChange: (v: string) => void
  onExit: () => void
  onCloseSession?: () => void
  onOpenFloors?: () => void
  hasRestaurant?: boolean
  user?: { name?: string; email?: string }
}

const TerminalHeader = forwardRef<HTMLInputElement, TerminalHeaderProps>(function TerminalHeader({
  registerName, sessionName, online, search, onSearchChange, onExit, onCloseSession, onOpenFloors, hasRestaurant, user,
}, ref) {
  const localRef = useRef<HTMLInputElement>(null)

  // Bridge external ref
  useEffect(() => {
    if (!ref) return
    if (typeof ref === 'function') ref(localRef.current)
    else (ref as React.MutableRefObject<HTMLInputElement | null>).current = localRef.current
  }, [ref])

  const initials = (user?.name ?? user?.email ?? '?')
    .split(/\s+/)
    .map(s => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <header className="h-14 shrink-0 flex items-center gap-3 px-4 border-b border-border/40 bg-card/60 backdrop-blur">
      {/* Exit */}
      <button
        onClick={onExit}
        className="h-10 w-10 rounded-full border border-border/40 bg-card flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-all duration-200"
        aria-label="Exit terminal"
      >
        <ArrowLeft className="h-5 w-5" />
      </button>

      {/* Register identity */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="hidden md:flex items-center gap-2 h-10 px-3 rounded-xl hover:bg-muted/40 transition-all duration-200 text-left"
          >
            <div>
              <p className="text-sm font-semibold leading-tight">
                {registerName ?? 'Register'}
              </p>
              <p className="text-[11px] text-muted-foreground leading-tight">
                {sessionName ? `Session ${sessionName}` : 'No session'}
              </p>
            </div>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel>{registerName ?? 'Register'}</DropdownMenuLabel>
          {sessionName && (
            <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
              {sessionName}
            </DropdownMenuLabel>
          )}
          <DropdownMenuSeparator />
          {onCloseSession && (
            <DropdownMenuItem onClick={onCloseSession} className="gap-2">
              <DoorClosed className="h-4 w-4" />
              Close Session
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Search bar */}
      <div className="flex-1 max-w-2xl mx-auto relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <input
          ref={localRef}
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          placeholder="Search products, SKU, barcode…  (press / to focus)"
          className="w-full h-10 rounded-xl border border-border/40 bg-muted/30 pl-9 pr-9 text-sm outline-none placeholder:text-muted-foreground/60 focus:border-emerald-500/40 focus:bg-card focus:ring-1 focus:ring-emerald-500/20 transition-all duration-200"
        />
        {search && (
          <button
            onClick={() => onSearchChange('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all duration-200"
            aria-label="Clear search"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Right cluster */}
      <div className="flex items-center gap-2">
        <div
          className={`hidden sm:flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-medium ${
            online
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
          }`}
        >
          {online ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
          {online ? 'Online' : 'Offline'}
        </div>
        <div className="hidden lg:block">
          <PosOfflineBadge />
        </div>

        {/* Avatar */}
        <div className="hidden md:flex items-center gap-2 h-8 px-2 rounded-full bg-muted/30">
          <div className="h-7 w-7 rounded-full bg-gradient-to-br from-emerald-500 to-blue-500 text-white flex items-center justify-center text-[11px] font-bold">
            {initials || '?'}
          </div>
          <span className="text-xs font-medium max-w-[120px] truncate">
            {user?.name ?? user?.email ?? 'User'}
          </span>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="h-10 w-10 rounded-full border border-border/40 bg-card flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-all duration-200"
              aria-label="More"
            >
              <MoreVertical className="h-5 w-5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {onCloseSession && (
              <DropdownMenuItem onClick={onCloseSession} className="gap-2">
                <DoorClosed className="h-4 w-4" />
                Close Session
              </DropdownMenuItem>
            )}
            {hasRestaurant && onOpenFloors && (
              <DropdownMenuItem onClick={onOpenFloors} className="gap-2">
                <Armchair className="h-4 w-4" />
                Restaurant Floors
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={onExit} className="gap-2">
              <Settings className="h-4 w-4" />
              Register Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onExit} className="gap-2 text-muted-foreground">
              <LogOut className="h-4 w-4" />
              Exit terminal
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
})

export default TerminalHeader
