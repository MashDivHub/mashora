import { useEffect, useState } from 'react'
import { LayoutDashboard, LifeBuoy, Package2, Receipt, Rocket, Settings2, Sparkles, Store, UserRoundPlus, Waypoints } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { ThemeToggle } from '@/components/theme-toggle'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

interface LayoutProps {
  children: React.ReactNode
}

const dashboardNavigation = [
  { to: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { to: '/addons', label: 'Marketplace', icon: Store },
  { to: '/dashboard/billing', label: 'Billing', icon: Receipt },
  { to: '/dashboard/upgrades', label: 'Upgrades', icon: Rocket },
  { to: '/dashboard/support', label: 'Support', icon: LifeBuoy },
  { to: '/dashboard/publisher', label: 'Publisher', icon: Package2 },
  { to: '/dashboard/admin', label: 'Admin', icon: Settings2 },
]

const marketingNavigation = [
  { to: '/', label: 'Platform' },
  { to: '/pricing', label: 'Pricing' },
  { to: '/addons', label: 'Marketplace' },
]

export default function Layout({ children }: LayoutProps) {
  const location = useLocation()
  const { isAuthenticated, logout, user, initFromStorage } = useAuthStore()
  const navigate = useNavigate()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    initFromStorage().finally(() => {
      if (!cancelled) {
        setReady(true)
      }
    })
    return () => {
      cancelled = true
    }
  }, [initFromStorage])

  function handleLogout() {
    logout()
    navigate('/login')
  }

  const isDashboardRoute = location.pathname.startsWith('/dashboard')
  const initials = (user?.org_name || user?.email || 'Mashora')
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="rounded-3xl border border-border bg-card/90 px-6 py-4 text-sm text-muted-foreground shadow-xl">
          Loading workspace...
        </div>
      </div>
    )
  }

  if (isDashboardRoute) {
    return (
      <div className="relative min-h-screen">
        <div className="relative flex min-h-screen">
          <aside className="hidden w-72 shrink-0 border-r border-border/70 bg-background/80 backdrop-blur 2xl:flex 2xl:flex-col">
            <div className="border-b border-border/70 px-6 py-6">
              <Link to="/" className="flex items-center gap-3">
                <div className="flex size-11 items-center justify-center rounded-2xl bg-zinc-900 text-sm font-semibold text-white shadow-lg shadow-zinc-950/20 dark:border dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50">
                  M
                </div>
                <div>
                  <div className="text-lg font-semibold tracking-tight">Mashora</div>
                  <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Business OS</div>
                </div>
              </Link>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-6">
              <div className="mb-6 rounded-3xl border border-zinc-800 bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-800 p-5 text-zinc-50 shadow-xl shadow-zinc-950/15">
                <div className="mb-4 flex items-center gap-3">
                  <div className="rounded-2xl bg-white/8 p-3 ring-1 ring-white/10">
                    <Waypoints className="size-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{user?.org_name || 'Workspace'}</p>
                    <p className="text-xs text-zinc-400">{user?.email || 'Connected account'}</p>
                  </div>
                </div>
                <p className="text-sm text-zinc-300">
                  One shell for provisioning, marketplace ops, upgrades, support, and platform control.
                </p>
              </div>

              <nav className="space-y-2">
                {dashboardNavigation.map(({ to, label, icon: Icon }) => {
                  const active = location.pathname === to || (to !== '/dashboard' && location.pathname.startsWith(to))
                  return (
                    <Link
                      key={to}
                      to={to}
                      className={cn(
                        'group flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-all',
                        active
                          ? 'bg-zinc-900 text-white shadow-lg shadow-zinc-950/15 dark:border dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50 dark:shadow-none'
                          : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                      )}
                    >
                      <Icon className="size-4" />
                      <span>{label}</span>
                    </Link>
                  )
                })}
              </nav>
            </div>
          </aside>

          <div className="flex min-h-screen min-w-0 flex-1 flex-col">
            <header className="sticky top-0 z-30 border-b border-border/70 bg-background/80 backdrop-blur">
              <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-3 px-4 py-4 sm:px-6 lg:px-10">
                <div className="min-w-0 2xl:hidden">
                  <Link to="/" className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-2xl bg-zinc-900 text-sm font-semibold text-white dark:border dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50">
                      M
                    </div>
                    <div>
                      <div className="text-sm font-semibold">Mashora</div>
                      <div className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Business OS</div>
                    </div>
                  </Link>
                </div>

                <div className="ml-auto flex items-center gap-3">
                  <ThemeToggle />
                  <Avatar className="size-9 lg:hidden">
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                  <div className="hidden min-w-0 items-center gap-3 rounded-full border border-border/70 bg-card/80 px-3 py-1.5 lg:flex">
                    <Avatar className="size-9">
                      <AvatarFallback>{initials}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{user?.org_name || 'Mashora'}</div>
                      <div className="truncate text-xs text-muted-foreground">{user?.email || 'Signed in'}</div>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleLogout}>
                    Logout
                  </Button>
                </div>

                <div className="order-3 w-full 2xl:hidden">
                  <div className="-mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1">
                    {dashboardNavigation.map(({ to, label }) => {
                      const active = location.pathname === to || (to !== '/dashboard' && location.pathname.startsWith(to))
                      return (
                        <Link
                          key={to}
                          to={to}
                          className={cn(
                            'shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors',
                            active
                              ? 'bg-zinc-900 text-white shadow-sm dark:border dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50'
                              : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                          )}
                        >
                          {label}
                        </Link>
                      )
                    })}
                  </div>
                </div>
              </div>
            </header>

            <main className="flex-1 overflow-y-auto">
              <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
                {children}
              </div>
            </main>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-3 px-4 py-4 sm:px-6 lg:px-10">
          <Link to="/" className="flex min-w-0 items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-zinc-900 text-sm font-semibold text-white shadow-lg shadow-zinc-950/15 dark:border dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50">
              M
            </div>
            <div>
              <div className="text-lg font-semibold tracking-tight">Mashora</div>
              <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Shadcn Workspace</div>
            </div>
          </Link>

          <nav className="order-3 hidden w-full items-center gap-2 overflow-x-auto pb-1 md:flex lg:order-none lg:w-auto lg:pb-0">
            {marketingNavigation.map(({ to, label }) => {
              const active = location.pathname === to
              return (
                <Link
                  key={to}
                  to={to}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors',
                    active
                      ? 'bg-zinc-900 text-white shadow-sm dark:border dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50'
                      : 'text-muted-foreground hover:bg-zinc-100 hover:text-zinc-950 dark:hover:bg-zinc-900/70 dark:hover:text-zinc-50'
                  )}
                >
                  {label}
                </Link>
              )
            })}
          </nav>

          <div className="ml-auto flex flex-wrap items-center justify-end gap-2 sm:gap-3">
            <ThemeToggle />
            {isAuthenticated ? (
              <>
                <Button variant="ghost" asChild>
                  <Link to="/dashboard">
                    <Sparkles className="size-4" />
                    Dashboard
                  </Link>
                </Button>
                <Button variant="outline" onClick={handleLogout}>
                  Logout
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" asChild>
                  <Link to="/login">Login</Link>
                </Button>
                <Link
                  to="/register"
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-zinc-50 shadow-sm transition-all hover:bg-zinc-800 dark:border dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50 dark:hover:bg-zinc-700"
                >
                  <UserRoundPlus className="size-4" />
                  Start Free
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-10 lg:py-12">
        {children}
      </main>
    </div>
  )
}
