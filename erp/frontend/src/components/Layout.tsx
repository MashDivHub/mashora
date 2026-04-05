import { Outlet, NavLink, useLocation } from 'react-router-dom'
import { useTheme } from 'next-themes'
import {
  LayoutDashboard,
  Users,
  ShoppingCart,
  Package,
  Warehouse,
  Calculator,
  Target,
  Globe,
  Sun,
  Moon,
  Menu,
  X,
  FolderKanban,
  Car,
  Wrench,
  Factory,
  CalendarDays,
  ClipboardList,
  Mail,
  Monitor,
  Calendar,
  UserCheck,
  Building2,
} from 'lucide-react'
import { Button, Avatar, AvatarFallback, ScrollArea, cn } from '@mashora/design-system'
import { useState } from 'react'

// ---------------------------------------------------------------------------
// Navigation structure – grouped into labelled sections
// ---------------------------------------------------------------------------

const navSections = [
  {
    label: 'Core',
    items: [
      { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { name: 'Contacts', href: '/partners', icon: Users },
    ],
  },
  {
    label: 'Sales & CRM',
    items: [
      { name: 'Sales', href: '/sales', icon: ShoppingCart },
      { name: 'CRM', href: '/crm', icon: Target },
    ],
  },
  {
    label: 'Supply Chain',
    items: [
      { name: 'Purchase', href: '/purchase', icon: Package },
      { name: 'Inventory', href: '/inventory', icon: Warehouse },
    ],
  },
  {
    label: 'Finance',
    items: [{ name: 'Accounting', href: '/accounting', icon: Calculator }],
  },
  {
    label: 'Operations',
    items: [
      { name: 'Manufacturing', href: '/manufacturing', icon: Factory },
      { name: 'HR', href: '/hr', icon: UserCheck },
      { name: 'Projects', href: '/projects', icon: FolderKanban },
    ],
  },
  {
    label: 'Online',
    items: [{ name: 'Website', href: '/website', icon: Globe }],
  },
  {
    label: 'Other',
    items: [
      { name: 'Fleet', href: '/fleet', icon: Car },
      { name: 'Repairs', href: '/repairs', icon: Wrench },
      { name: 'Events', href: '/events', icon: CalendarDays },
      { name: 'Surveys', href: '/surveys', icon: ClipboardList },
      { name: 'Email Marketing', href: '/email-marketing', icon: Mail },
      { name: 'POS', href: '/pos', icon: Monitor },
      { name: 'Calendar', href: '/calendar', icon: Calendar },
    ],
  },
]

// Flat list used for the mobile horizontal pill nav
const allNavItems = navSections.flatMap((s) => s.items)

// ---------------------------------------------------------------------------
// ThemeToggle
// ---------------------------------------------------------------------------

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
      aria-label="Toggle theme"
    >
      {resolvedTheme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  )
}

// ---------------------------------------------------------------------------
// Sidebar content – shared between desktop aside and mobile drawer
// ---------------------------------------------------------------------------

function SidebarContent({ onClose }: { onClose?: () => void }) {
  const location = useLocation()

  return (
    <>
      {/* Logo */}
      <div className="border-b border-border/70 px-6 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-zinc-900 text-sm font-semibold text-white shadow-lg shadow-zinc-950/20 dark:border dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50">
              M
            </div>
            <div>
              <div className="text-lg font-semibold tracking-tight">Mashora</div>
              <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                Enterprise
              </div>
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              aria-label="Close navigation"
              className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <X className="size-5" />
            </button>
          )}
        </div>
      </div>

      {/* Scrollable body */}
      <ScrollArea className="flex-1">
        <div className="px-4 py-6">
          {/* Workspace card */}
          <div className="mb-6 rounded-3xl border border-zinc-800 bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-800 p-5 text-zinc-50 shadow-xl shadow-zinc-950/15">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-2xl bg-white/8 p-3 ring-1 ring-white/10">
                <Building2 className="size-5" />
              </div>
              <div>
                <p className="text-sm font-semibold">Mashora ERP</p>
                <p className="text-xs text-zinc-400">Enterprise Resource Planning</p>
              </div>
            </div>
            <p className="text-sm text-zinc-300">
              Unified operations across finance, supply chain, HR, and more.
            </p>
          </div>

          {/* Sectioned navigation */}
          <nav className="space-y-6" aria-label="Main navigation">
            {navSections.map((section) => (
              <div key={section.label}>
                <p className="mb-2 px-4 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                  {section.label}
                </p>
                <div className="space-y-0.5">
                  {section.items.map((item) => {
                    const Icon = item.icon
                    const isActive = location.pathname.startsWith(item.href)
                    return (
                      <NavLink
                        key={item.name}
                        to={item.href}
                        onClick={onClose}
                        aria-current={isActive ? 'page' : undefined}
                        className={cn(
                          'flex items-center gap-3 rounded-2xl px-4 py-2.5 text-sm font-medium transition-all',
                          isActive
                            ? 'bg-zinc-900 text-white shadow-lg shadow-zinc-950/15 dark:border dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50 dark:shadow-none'
                            : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                        )}
                      >
                        <Icon className="size-4 shrink-0" />
                        <span>{item.name}</span>
                      </NavLink>
                    )
                  })}
                </div>
              </div>
            ))}
          </nav>
        </div>
      </ScrollArea>
    </>
  )
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()

  return (
    <div className="relative flex min-h-screen">
      {/* ------------------------------------------------------------------ */}
      {/* Desktop sidebar – visible only at 2xl+                             */}
      {/* ------------------------------------------------------------------ */}
      <aside className="hidden w-72 shrink-0 border-r border-border/70 bg-background/80 backdrop-blur 2xl:flex 2xl:flex-col">
        <SidebarContent />
      </aside>

      {/* ------------------------------------------------------------------ */}
      {/* Mobile sidebar overlay                                              */}
      {/* ------------------------------------------------------------------ */}
      {sidebarOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-zinc-950/60 backdrop-blur-sm 2xl:hidden"
            aria-hidden="true"
            onClick={() => setSidebarOpen(false)}
          />

          {/* Drawer */}
          <aside
            className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-border/70 bg-background/95 backdrop-blur 2xl:hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
          >
            <SidebarContent onClose={() => setSidebarOpen(false)} />
          </aside>
        </>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Main column                                                         */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        {/* Header */}
        <header className="sticky top-0 z-30 border-b border-border/70 bg-background/80 backdrop-blur">
          <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-3 px-4 py-4 sm:px-6 lg:px-10">
            {/* Mobile: logo + hamburger */}
            <div className="flex items-center gap-3 2xl:hidden">
              <button
                onClick={() => setSidebarOpen(true)}
                aria-label="Open navigation"
                className="rounded-xl p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <Menu className="size-5" />
              </button>
              <div className="flex items-center gap-2.5">
                <div className="flex size-9 items-center justify-center rounded-2xl bg-zinc-900 text-sm font-semibold text-white dark:border dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50">
                  M
                </div>
                <div>
                  <div className="text-sm font-semibold">Mashora</div>
                  <div className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                    Enterprise
                  </div>
                </div>
              </div>
            </div>

            {/* Right side: theme + user */}
            <div className="ml-auto flex items-center gap-3">
              <ThemeToggle />

              {/* User avatar pill – mobile shows icon only */}
              <Avatar className="size-8 2xl:hidden">
                <AvatarFallback className="text-xs font-semibold">ME</AvatarFallback>
              </Avatar>

              <div className="hidden min-w-0 items-center gap-3 rounded-full border border-border/70 bg-card/80 px-3 py-1.5 2xl:flex">
                <Avatar className="size-8">
                  <AvatarFallback className="text-xs font-semibold">ME</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">Mashora ERP</div>
                  <div className="truncate text-xs text-muted-foreground">Enterprise</div>
                </div>
              </div>
            </div>

            {/* Mobile horizontal pill nav – scrolls horizontally below 2xl */}
            <div className="order-3 w-full 2xl:hidden">
              <div
                className="-mx-1 flex items-center gap-1.5 overflow-x-auto px-1 pb-1"
                role="navigation"
                aria-label="Quick navigation"
              >
                {allNavItems.map((item) => {
                  const isActive = location.pathname.startsWith(item.href)
                  return (
                    <NavLink
                      key={item.name}
                      to={item.href}
                      aria-current={isActive ? 'page' : undefined}
                      className={cn(
                        'shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-zinc-900 text-white shadow-sm dark:border dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50'
                          : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                      )}
                    >
                      {item.name}
                    </NavLink>
                  )
                })}
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
