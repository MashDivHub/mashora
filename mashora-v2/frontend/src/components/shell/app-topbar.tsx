import { LogOut, PanelLeft, Search, Sparkles } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/shell/theme-toggle'
import { toInitials } from '@/lib/format'
import type { ErpAction } from '@/services/erp/actions'
import type { ErpMenu } from '@/services/erp/menus'

interface AppTopbarProps {
  menuTrail: ErpMenu[]
  action: ErpAction | null
  userName?: string
  onOpenSidebar: () => void
  onOpenCommand: () => void
  onLogout: () => void
}

export function AppTopbar({
  menuTrail,
  action,
  userName,
  onOpenSidebar,
  onOpenCommand,
  onLogout,
}: AppTopbarProps) {
  return (
    <header className="sticky top-4 z-30">
      <div className="glass-panel app-shell-backdrop flex items-center gap-3 rounded-[28px] border border-border/70 px-4 py-3 shadow-[0_18px_60px_-36px_rgba(15,23,42,0.75)]">
        <Button type="button" variant="secondary" size="icon" className="lg:hidden" onClick={onOpenSidebar}>
          <PanelLeft className="size-4" />
        </Button>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {menuTrail.map((menu, index) => (
              <div key={menu.id} className="flex items-center gap-2">
                <span className={index === menuTrail.length - 1 ? 'text-sm font-semibold' : 'text-sm text-muted-foreground'}>
                  {menu.name}
                </span>
                {index !== menuTrail.length - 1 ? <span className="text-muted-foreground">/</span> : null}
              </div>
            ))}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>{action?.res_model || 'ERP workspace'}</span>
            {action?.type ? <Badge variant="outline">{action.type}</Badge> : null}
          </div>
        </div>

        <Button type="button" variant="secondary" className="hidden min-w-[220px] justify-between lg:flex" onClick={onOpenCommand}>
          <span className="flex items-center gap-2">
            <Search className="size-4" />
            Search modules and actions
          </span>
          <span className="rounded-full border border-border/70 px-2 py-0.5 text-xs text-muted-foreground">
            Ctrl K
          </span>
        </Button>

        <Button type="button" variant="secondary" size="icon" className="lg:hidden" onClick={onOpenCommand}>
          <Search className="size-4" />
        </Button>

        <ThemeToggle />

        <div className="hidden items-center gap-3 rounded-2xl border border-border/60 bg-card/60 px-3 py-2 sm:flex">
          <Avatar className="size-9">
            <AvatarFallback>{toInitials(userName)}</AvatarFallback>
          </Avatar>
          <div className="hidden lg:block">
            <div className="text-sm font-medium">{userName || 'Mashora User'}</div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Sparkles className="size-3" />
              Live backend session
            </div>
          </div>
        </div>

        <Button type="button" variant="ghost" size="icon" onClick={onLogout} aria-label="Log out">
          <LogOut className="size-4" />
        </Button>
      </div>
    </header>
  )
}
