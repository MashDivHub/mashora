import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom'
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
  Search,
  PanelLeftClose,
  PanelLeftOpen,
  LogOut,
  Settings,
  User,
  Languages,
  Bell,
  ChevronDown,
} from 'lucide-react'
import {
  Button,
  Avatar,
  AvatarFallback,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  cn,
} from '@mashora/design-system'
import { useState, useEffect, useCallback, useRef } from 'react'

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

const allNavItems = navSections.flatMap((s) => s.items)

// Consistent header height used by both sidebar and main header
const HEADER_HEIGHT = 'h-16'

// Available locales
const LOCALES = [
  { code: 'en', label: 'English' },
  { code: 'ar', label: 'العربية' },
  { code: 'fr', label: 'Français' },
  { code: 'es', label: 'Español' },
]

// ---------------------------------------------------------------------------
// Command Palette (Cmd+K search)
// ---------------------------------------------------------------------------

function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (open) {
      setQuery('')
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  const filtered = query.trim()
    ? allNavItems.filter((item) =>
        item.name.toLowerCase().includes(query.toLowerCase())
      )
    : allNavItems

  function handleSelect(href: string) {
    navigate(href)
    onClose()
  }

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-zinc-950/60 backdrop-blur-sm" onClick={onClose} />

      {/* Dialog */}
      <div className="fixed inset-x-0 top-[20%] z-50 mx-auto w-full max-w-lg px-4">
        <div className="overflow-hidden rounded-2xl border border-border/60 bg-popover shadow-2xl">
          {/* Search input */}
          <div className="flex items-center gap-3 border-b border-border/70 px-4">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search modules..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') onClose()
                if (e.key === 'Enter' && filtered.length > 0) {
                  handleSelect(filtered[0].href)
                }
              }}
              className="flex-1 bg-transparent py-4 text-sm outline-none placeholder:text-muted-foreground"
            />
            <kbd className="hidden rounded-md border border-border/70 bg-muted/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline-block">
              ESC
            </kbd>
          </div>

          {/* Results */}
          <div className="max-h-72 overflow-y-auto p-2">
            {filtered.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                No modules found for "{query}"
              </div>
            ) : (
              filtered.map((item) => {
                const Icon = item.icon
                return (
                  <button
                    key={item.name}
                    onClick={() => handleSelect(item.href)}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-foreground transition-colors hover:bg-accent"
                  >
                    <Icon className="size-4 shrink-0 text-muted-foreground" />
                    <span className="font-medium">{item.name}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{item.href}</span>
                  </button>
                )
              })
            )}
          </div>
        </div>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// ThemeToggle
// ---------------------------------------------------------------------------

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
          aria-label="Toggle theme"
          className="rounded-full border border-border/70 bg-background/70 backdrop-blur"
        >
          {resolvedTheme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>{resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}</p>
      </TooltipContent>
    </Tooltip>
  )
}

// ---------------------------------------------------------------------------
// SidebarNav – the scrollable navigation area
// ---------------------------------------------------------------------------

function SidebarNav({ collapsed, onClose }: { collapsed?: boolean; onClose?: () => void }) {
  const location = useLocation()

  if (collapsed) {
    return (
      <div className="flex-1 overflow-y-auto overflow-x-hidden py-4">
        <nav className="flex flex-col items-center gap-1 px-2" aria-label="Main navigation">
          {allNavItems.map((item) => {
            const Icon = item.icon
            const isActive = location.pathname.startsWith(item.href)
            return (
              <Tooltip key={item.name}>
                <TooltipTrigger asChild>
                  <NavLink
                    to={item.href}
                    aria-current={isActive ? 'page' : undefined}
                    className={cn(
                      'flex size-10 items-center justify-center rounded-xl transition-all',
                      isActive
                        ? 'bg-zinc-900 text-white shadow-lg shadow-zinc-950/15 dark:border dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                    )}
                  >
                    <Icon className="size-4" />
                  </NavLink>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p>{item.name}</p>
                </TooltipContent>
              </Tooltip>
            )
          })}
        </nav>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-4">
      {/* Workspace card */}
      <div className="mb-5 rounded-3xl border border-zinc-800 bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-800 p-5 text-zinc-50 shadow-xl shadow-zinc-950/15">
        <div className="mb-3 flex items-center gap-3">
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
      <nav className="space-y-5" aria-label="Main navigation">
        {navSections.map((section) => (
          <div key={section.label}>
            <p className="mb-1.5 px-4 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
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
  )
}

// ---------------------------------------------------------------------------
// SidebarHeader – matches the main header height exactly
// ---------------------------------------------------------------------------

function SidebarHeader({
  collapsed,
  onToggle,
  onClose,
}: {
  collapsed?: boolean
  onToggle?: () => void
  onClose?: () => void
}) {
  return (
    <div className={cn('flex shrink-0 items-center border-b border-border/70 px-4', HEADER_HEIGHT)}>
      <div className="flex flex-1 items-center justify-between">
        {collapsed ? (
          // Collapsed: just show the M icon centered
          <div className="mx-auto flex size-9 items-center justify-center rounded-2xl bg-zinc-900 text-sm font-semibold text-white shadow-lg shadow-zinc-950/20 dark:border dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50">
            M
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 pl-2">
              <div className="flex size-9 items-center justify-center rounded-2xl bg-zinc-900 text-sm font-semibold text-white shadow-lg shadow-zinc-950/20 dark:border dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50">
                M
              </div>
              <div>
                <div className="text-base font-semibold tracking-tight">Mashora</div>
                <div className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
                  Enterprise
                </div>
              </div>
            </div>
            {onClose ? (
              <button
                onClick={onClose}
                aria-label="Close navigation"
                className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            ) : onToggle ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={onToggle}
                    aria-label="Collapse sidebar"
                    className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    <PanelLeftClose className="size-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p>Collapse sidebar</p>
                </TooltipContent>
              </Tooltip>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [commandOpen, setCommandOpen] = useState(false)
  const [locale, setLocale] = useState('en')

  // Cmd+K / Ctrl+K shortcut
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setCommandOpen((prev) => !prev)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  const toggleCollapse = useCallback(() => setSidebarCollapsed((prev) => !prev), [])

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-screen overflow-hidden">
        {/* ---------------------------------------------------------------- */}
        {/* Desktop sidebar – collapsible                                    */}
        {/* ---------------------------------------------------------------- */}
        <aside
          className={cn(
            'hidden shrink-0 flex-col border-r border-border/70 bg-background/80 backdrop-blur transition-[width] duration-300 lg:flex',
            sidebarCollapsed ? 'w-[68px]' : 'w-72'
          )}
        >
          <SidebarHeader collapsed={sidebarCollapsed} onToggle={toggleCollapse} />

          {/* Expand button when collapsed */}
          {sidebarCollapsed && (
            <div className="flex justify-center border-b border-border/70 py-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={toggleCollapse}
                    aria-label="Expand sidebar"
                    className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    <PanelLeftOpen className="size-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p>Expand sidebar</p>
                </TooltipContent>
              </Tooltip>
            </div>
          )}

          <SidebarNav collapsed={sidebarCollapsed} />
        </aside>

        {/* ---------------------------------------------------------------- */}
        {/* Mobile sidebar overlay                                            */}
        {/* ---------------------------------------------------------------- */}
        {sidebarOpen && (
          <>
            <div
              className="fixed inset-0 z-40 bg-zinc-950/60 backdrop-blur-sm lg:hidden"
              aria-hidden="true"
              onClick={() => setSidebarOpen(false)}
            />
            <aside
              className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-border/70 bg-background/95 backdrop-blur lg:hidden"
              role="dialog"
              aria-modal="true"
              aria-label="Navigation"
            >
              <SidebarHeader onClose={() => setSidebarOpen(false)} />
              <SidebarNav onClose={() => setSidebarOpen(false)} />
            </aside>
          </>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* Main column                                                       */}
        {/* ---------------------------------------------------------------- */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Header */}
          <header
            className={cn(
              'flex shrink-0 items-center border-b border-border/70 bg-background/80 backdrop-blur z-30',
              HEADER_HEIGHT
            )}
          >
            <div className="flex w-full items-center gap-3 px-4 sm:px-6 lg:px-8">
              {/* Mobile hamburger + logo */}
              <div className="flex items-center gap-3 lg:hidden">
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
                  <div className="hidden sm:block">
                    <div className="text-sm font-semibold">Mashora</div>
                    <div className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
                      Enterprise
                    </div>
                  </div>
                </div>
              </div>

              {/* Search bar */}
              <button
                onClick={() => setCommandOpen(true)}
                className="hidden items-center gap-2 rounded-xl border border-border/70 bg-muted/30 px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted/50 sm:flex"
              >
                <Search className="size-3.5" />
                <span>Search...</span>
                <kbd className="ml-4 rounded-md border border-border/70 bg-muted/60 px-1.5 py-0.5 text-[10px] font-medium">
                  ⌘K
                </kbd>
              </button>

              {/* Right side controls */}
              <div className="ml-auto flex items-center gap-2">
                {/* Mobile search icon */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setCommandOpen(true)}
                      aria-label="Search"
                      className="rounded-full border border-border/70 bg-background/70 backdrop-blur sm:hidden"
                    >
                      <Search className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Search (⌘K)</p>
                  </TooltipContent>
                </Tooltip>

                {/* Theme toggle */}
                <ThemeToggle />

                {/* Locale selector */}
                <DropdownMenu>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Change language"
                          className="rounded-full border border-border/70 bg-background/70 backdrop-blur"
                        >
                          <Languages className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Language</p>
                    </TooltipContent>
                  </Tooltip>
                  <DropdownMenuContent align="end" className="w-40">
                    <DropdownMenuLabel>Language</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {LOCALES.map((l) => (
                      <DropdownMenuItem
                        key={l.code}
                        onClick={() => setLocale(l.code)}
                        className={cn(
                          'cursor-pointer rounded-lg',
                          locale === l.code && 'bg-accent font-medium'
                        )}
                      >
                        {l.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Notifications */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Notifications"
                      className="relative rounded-full border border-border/70 bg-background/70 backdrop-blur"
                    >
                      <Bell className="h-4 w-4" />
                      <span className="absolute -right-0.5 -top-0.5 flex size-3.5 items-center justify-center rounded-full bg-destructive text-[8px] font-bold text-white">
                        3
                      </span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Notifications</p>
                  </TooltipContent>
                </Tooltip>

                {/* Profile dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-2 rounded-full border border-border/70 bg-card/80 py-1 pl-1 pr-2.5 transition-colors hover:bg-accent">
                      <Avatar className="size-7">
                        <AvatarFallback className="text-xs font-semibold">ME</AvatarFallback>
                      </Avatar>
                      <span className="hidden text-sm font-medium lg:inline">Admin</span>
                      <ChevronDown className="hidden size-3 text-muted-foreground lg:block" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>
                      <div className="flex flex-col gap-1">
                        <span className="font-semibold">Mashora Admin</span>
                        <span className="text-xs font-normal text-muted-foreground">
                          admin@mashora.com
                        </span>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="cursor-pointer rounded-lg gap-2">
                      <User className="size-4" />
                      My Profile
                    </DropdownMenuItem>
                    <DropdownMenuItem className="cursor-pointer rounded-lg gap-2">
                      <Settings className="size-4" />
                      Settings
                    </DropdownMenuItem>
                    <DropdownMenuItem className="cursor-pointer rounded-lg gap-2">
                      <Bell className="size-4" />
                      Notifications
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="cursor-pointer rounded-lg gap-2 text-destructive focus:text-destructive">
                      <LogOut className="size-4" />
                      Log out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </header>

          {/* Page content – only part that scrolls */}
          <main className="flex-1 overflow-y-auto">
            <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
              <Outlet />
            </div>
          </main>
        </div>

        {/* Command palette */}
        <CommandPalette open={commandOpen} onClose={() => setCommandOpen(false)} />
      </div>
    </TooltipProvider>
  )
}
