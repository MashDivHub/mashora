import { Layers3 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AppLogo } from '@/components/shell/app-logo'
import { titleCase } from '@/lib/format'
import {
  findFirstActionableMenu,
  getApps,
  getCurrentApp,
  getMenu,
  type ErpMenu,
  type ErpMenuCollection,
} from '@/services/erp/menus'
import { cn } from '@/lib/utils'

interface AppSidebarProps {
  menus: ErpMenuCollection
  currentMenuId?: number
  mobileOpen: boolean
  onOpenChange: (open: boolean) => void
  onNavigate: (menuId: number) => void
}

interface SidebarItem {
  menu: ErpMenu
  depth: number
}

function presentMenuName(name: string) {
  return /^[a-z0-9_]+$/.test(name) ? titleCase(name) : name
}

function collectBranch(menus: ErpMenuCollection, menu: ErpMenu | undefined) {
  const items: SidebarItem[] = []
  if (!menu) {
    return items
  }

  const visit = (parent: ErpMenu, depth: number) => {
    parent.children
      .map((childId) => getMenu(menus, childId))
      .filter((child): child is ErpMenu => Boolean(child))
      .forEach((child) => {
        if (child.actionID) {
          items.push({ menu: child, depth })
        }
        visit(child, depth + 1)
      })
  }

  visit(menu, 0)
  return items
}

export function AppSidebar({
  menus,
  currentMenuId,
  mobileOpen,
  onOpenChange,
  onNavigate,
}: AppSidebarProps) {
  const apps = getApps(menus)
  const currentApp = getCurrentApp(menus, currentMenuId)
  const currentBranch = collectBranch(menus, currentApp)

  return (
    <>
      <div
        className={cn(
          'fixed inset-0 z-40 bg-slate-950/55 backdrop-blur-sm transition lg:hidden',
          mobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        )}
        onClick={() => onOpenChange(false)}
      />

      <aside
        className={cn(
          'glass-panel fixed inset-y-4 left-4 z-50 flex w-[min(88vw,320px)] flex-col rounded-[32px] border border-border/70 p-4 shadow-2xl transition-transform duration-300 lg:w-[300px] lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-[120%]'
        )}
      >
        <AppLogo />

        <div className="mt-6 rounded-[24px] border border-primary/12 bg-primary/10 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Frontend Rewrite</div>
              <div className="mt-1 text-xs text-muted-foreground">
                New shell, same ERP backend.
              </div>
            </div>
            <Layers3 className="size-5 text-primary" />
          </div>
        </div>

        <div className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Workspaces
            </div>
            <Badge variant="outline">{apps.length}</Badge>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {apps.map((app) => {
              const targetMenu = findFirstActionableMenu(menus, app.id) || app
              const isActive = currentApp?.id === app.id
              return (
                <button
                  key={app.id}
                  type="button"
                  onClick={() => {
                    onNavigate(targetMenu.id)
                    onOpenChange(false)
                  }}
                  className={cn(
                    'rounded-2xl border px-3 py-3 text-left transition',
                    isActive
                      ? 'border-primary/30 bg-primary/12'
                      : 'border-border/60 bg-card/40 hover:border-primary/20 hover:bg-accent/50'
                  )}
                >
                  <div className="mb-2 flex items-center gap-3">
                    {app.webIconData ? (
                      <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border/60 bg-card/70 p-1.5">
                        <img src={app.webIconData} alt={presentMenuName(app.name)} className="h-full w-full object-contain" />
                      </div>
                    ) : null}
                    <div className="min-w-0 text-sm font-medium">{presentMenuName(app.name)}</div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {app.id === currentApp?.id ? 'Active workspace' : 'Open workspace'}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        <div className="mt-6 min-h-0 flex-1 overflow-y-auto">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {currentApp?.name || 'Module Nav'}
            </div>
            {currentBranch.length ? <Badge variant="secondary">{currentBranch.length}</Badge> : null}
          </div>

          <div className="space-y-1">
            {currentBranch.length ? (
              currentBranch.map(({ menu, depth }) => {
                const isActive = currentMenuId === menu.id
                return (
                  <button
                    key={menu.id}
                    type="button"
                    onClick={() => {
                      onNavigate(menu.id)
                      onOpenChange(false)
                    }}
                    className={cn(
                      'flex w-full items-center rounded-2xl px-3 py-3 text-left text-sm transition',
                      isActive
                        ? 'bg-primary/12 text-primary'
                        : 'text-foreground/90 hover:bg-accent/60 hover:text-foreground'
                    )}
                    style={{ paddingLeft: `${depth * 14 + 12}px` }}
                  >
                    <span className="truncate">{presentMenuName(menu.name)}</span>
                  </button>
                )
              })
            ) : (
              <div className="rounded-2xl border border-dashed border-border/70 p-4 text-sm text-muted-foreground">
                This workspace only exposes a root action right now.
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 pt-4">
          <Button variant="secondary" className="w-full" onClick={() => onOpenChange(false)}>
            Hide navigation
          </Button>
        </div>
      </aside>
    </>
  )
}
