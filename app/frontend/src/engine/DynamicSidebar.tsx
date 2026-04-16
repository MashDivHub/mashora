import { useQuery } from '@tanstack/react-query'
import { useLocation, useNavigate } from 'react-router-dom'
import { fetchMenuTree } from './ActionService'
import { cn } from '@mashora/design-system'
import {
  LayoutDashboard, ShoppingCart, Calculator, Package, Warehouse, Users,
  Target, Globe, UserCheck, FolderKanban, Settings, ChevronRight,
  Building2
} from 'lucide-react'

// Map menu names/web_icon to lucide icons
const ICON_MAP: Record<string, any> = {
  'Sales': ShoppingCart,
  'Invoicing': Calculator,
  'Accounting': Calculator,
  'Purchase': Package,
  'Inventory': Warehouse,
  'Contacts': Users,
  'CRM': Target,
  'Website': Globe,
  'Employees': UserCheck,
  'Project': FolderKanban,
  'Settings': Settings,
  'Discuss': Building2,
}

function getIconForMenu(menu: any): any {
  for (const [key, icon] of Object.entries(ICON_MAP)) {
    if (menu.name?.includes(key)) return icon
  }
  return LayoutDashboard
}

interface MenuItemProps {
  menu: any
  depth: number
  onNavigate?: () => void
}

function MenuItem({ menu, depth, onNavigate }: MenuItemProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const hasChildren = menu.children && menu.children.length > 0
  const hasAction = menu.action && menu.action !== false

  // Determine if this is a section header (has children, no action, depth 0-1)
  const isSection = hasChildren && !hasAction && depth <= 1

  const handleClick = () => {
    if (hasAction) {
      const actionRef = menu.action
      let actionModel = ''
      let actionId: string | null = null

      if (typeof actionRef === 'string' && actionRef.includes(',')) {
        const parts = actionRef.split(',')
        actionModel = parts[0]
        actionId = parts[1]
      } else if (Array.isArray(actionRef)) {
        actionId = String(typeof actionRef[0] === 'number' ? actionRef[0] : actionRef[1])
      }

      if (actionId) {
        // Encode action model type in URL so ActionRouter can resolve correctly
        const path = actionModel ? `/admin/action/${actionModel},${actionId}` : `/admin/action/${actionId}`
        navigate(path)
        onNavigate?.()
      }
    }
  }

  if (isSection) {
    return (
      <div className="space-y-0.5">
        <p className="mb-1.5 px-4 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          {menu.name}
        </p>
        {menu.children.map((child: any) => (
          <MenuItem key={child.id} menu={child} depth={depth + 1} onNavigate={onNavigate} />
        ))}
      </div>
    )
  }

  const Icon = getIconForMenu(menu)
  const actionPath = hasAction
    ? `/admin/action/${typeof menu.action === 'string' ? menu.action : ''}`
    : ''
  const isActive = actionPath && location.pathname.startsWith(actionPath)

  return (
    <>
      <button
        onClick={handleClick}
        className={cn(
          'flex w-full items-center gap-3 rounded-2xl px-4 py-2.5 text-sm font-medium transition-all text-left',
          isActive
            ? 'bg-zinc-900 text-white shadow-lg shadow-zinc-950/15 dark:border dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50 dark:shadow-none'
            : 'text-muted-foreground hover:bg-accent hover:text-foreground'
        )}
      >
        {depth <= 2 && <Icon className="size-4 shrink-0" />}
        <span className="truncate">{menu.name}</span>
        {hasChildren && <ChevronRight className="ml-auto size-3 shrink-0 text-muted-foreground" />}
      </button>
      {hasChildren && (
        <div className="ml-4 space-y-0.5">
          {menu.children.map((child: any) => (
            <MenuItem key={child.id} menu={child} depth={depth + 1} onNavigate={onNavigate} />
          ))}
        </div>
      )}
    </>
  )
}

interface DynamicSidebarProps {
  onNavigate?: () => void
}

export default function DynamicSidebar({ onNavigate }: DynamicSidebarProps) {
  const { data: menuTree, isLoading } = useQuery({
    queryKey: ['menuTree'],
    queryFn: fetchMenuTree,
    staleTime: 5 * 60 * 1000, // 5 min cache
  })

  if (isLoading) {
    return (
      <div className="space-y-3 px-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-8 animate-pulse rounded-2xl bg-muted/40" />
        ))}
      </div>
    )
  }

  if (!menuTree || menuTree.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-sm text-muted-foreground">
        No menus available
      </div>
    )
  }

  return (
    <nav className="space-y-5" aria-label="Dynamic navigation">
      {menuTree.map((rootMenu: any) => (
        <MenuItem key={rootMenu.id} menu={rootMenu} depth={0} onNavigate={onNavigate} />
      ))}
    </nav>
  )
}
