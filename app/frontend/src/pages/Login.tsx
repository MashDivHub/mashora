import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from 'next-themes'
import { ArrowRight, MoonStar, SunMedium, Layers, Shield, Zap } from 'lucide-react'
import { Button, Card, CardContent, Input, Label } from '@mashora/design-system'
import { useAuthStore } from '@/engine/AuthStore'

// ─── Theme Toggle ──────────────────────────────────────────────────────────────

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="flex size-9 items-center justify-center rounded-full border border-border/70 bg-background/70 text-muted-foreground backdrop-blur transition-colors hover:bg-accent hover:text-foreground"
    >
      {isDark ? <SunMedium className="size-4" /> : <MoonStar className="size-4" />}
    </button>
  )
}

// ─── Feature bullets (left panel) ─────────────────────────────────────────────

const features = [
  { text: 'Unified workspace for every business operation' },
  { text: 'Real-time data across sales, inventory, and accounting' },
  { text: 'Role-based access with enterprise-grade security' },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Login() {
  const navigate = useNavigate()
  const { login, loading, error, isAuthenticated, clearError } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true })
    }
  }, [isAuthenticated, navigate])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    clearError()
    const ok = await login(email, password)
    if (ok) {
      navigate('/dashboard', { replace: true })
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col">
      {/* Theme toggle — top right */}
      <div className="absolute right-5 top-5 z-10">
        <ThemeToggle />
      </div>

      {/* Main layout: two columns on lg, stacked on mobile */}
      <div className="flex flex-1 items-center justify-center p-4 lg:grid lg:min-h-screen lg:grid-cols-[1fr_1fr] lg:p-0">

        {/* ── Left: dark hero panel ───────────────────────────────────────── */}
        <div className="relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between lg:p-12">
          {/* Radial gradient layer */}
          <div className="absolute inset-0 bg-zinc-950 dark:bg-zinc-900" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(14,165,233,0.30),transparent_36%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.24),transparent_40%)]" />

          {/* Content */}
          <div className="relative z-10 flex flex-col gap-12">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-white/10 text-sm font-semibold text-white ring-1 ring-white/20">
                M
              </div>
              <div>
                <div className="text-base font-semibold tracking-tight text-white">Mashora</div>
                <div className="text-xs uppercase tracking-[0.24em] text-zinc-400">Enterprise</div>
              </div>
            </div>

            {/* Headline */}
            <div className="space-y-4">
              <h1 className="text-4xl font-semibold tracking-tight text-white lg:text-5xl">
                Your entire business, one workspace.
              </h1>
              <p className="max-w-sm text-base leading-7 text-zinc-300">
                Operations, finance, sales, inventory, and HR — managed from a single, focused interface built for real work.
              </p>
            </div>

            {/* Feature bullets */}
            <div className="grid gap-3">
              {features.map(({ text }) => (
                <div
                  key={text}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-200"
                >
                  {text}
                </div>
              ))}
            </div>
          </div>

          {/* Bottom module icons row */}
          <div className="relative z-10 flex items-center gap-4 pt-8">
            {[Layers, Shield, Zap].map((Icon, i) => (
              <div
                key={i}
                className="flex size-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-zinc-400"
              >
                <Icon className="size-4" />
              </div>
            ))}
            <span className="text-xs text-zinc-500">Phase 0 Proof of Concept</span>
          </div>
        </div>

        {/* ── Right: login card ────────────────────────────────────────────── */}
        <div className="flex w-full items-center justify-center lg:bg-background/60 lg:px-12">
          <div className="w-full max-w-md">
            {/* Mobile-only logo */}
            <div className="mb-8 flex items-center gap-3 lg:hidden">
              <div className="flex size-10 items-center justify-center rounded-2xl bg-zinc-900 text-sm font-semibold text-white dark:border dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50">
                M
              </div>
              <div>
                <div className="text-sm font-semibold">Mashora</div>
                <div className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                  Enterprise
                </div>
              </div>
            </div>

            <Card className="rounded-3xl border border-border/60 bg-card/95 shadow-[0_20px_80px_-48px_rgba(15,23,42,0.45)]">
              <CardContent className="p-8">
                {/* Card logo — desktop */}
                <div className="mb-8 hidden items-center gap-3 lg:flex">
                  <div className="flex size-11 items-center justify-center rounded-2xl bg-zinc-900 text-sm font-semibold text-white shadow-lg shadow-zinc-950/20 dark:border dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50">
                    M
                  </div>
                  <div>
                    <div className="text-base font-semibold tracking-tight">Mashora</div>
                    <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                      Enterprise
                    </div>
                  </div>
                </div>

                {/* Heading */}
                <div className="mb-8 space-y-1.5">
                  <h2 className="text-2xl font-semibold tracking-tight">Sign in</h2>
                  <p className="text-sm text-muted-foreground">
                    Access your Mashora ERP workspace.
                  </p>
                </div>

                {/* Form */}
                <form onSubmit={handleLogin} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email address</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="admin@mashora.com"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>

                  {error && (
                    <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                      {error}
                    </p>
                  )}

                  <Button
                    type="submit"
                    disabled={loading}
                    className="h-11 w-full rounded-xl bg-zinc-900 text-zinc-50 hover:bg-zinc-800 dark:border dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50 dark:hover:bg-zinc-700"
                  >
                    {loading ? (
                      'Signing in...'
                    ) : (
                      <>
                        Sign in
                        <ArrowRight className="size-4" />
                      </>
                    )}
                  </Button>
                </form>

                {/* Divider */}
                <div className="my-6 border-t border-border/60" />

                {/* Hint */}
                <p className="text-center text-xs text-muted-foreground">
                  <a href="#" className="underline underline-offset-4 hover:text-foreground">
                    Forgot your password?
                  </a>
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
