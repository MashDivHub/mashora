import { useState, type FormEvent } from 'react'
import { ArrowRight, ShieldCheck } from 'lucide-react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Notice } from '@/components/app/notice'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuthStore } from '../store/authStore'

export default function Login() {
  const demoEmail = 'demo@mashora.com'
  const demoPassword = 'Demo@123456'
  const [searchParams] = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const login = useAuthStore((s) => s.login)
  const navigate = useNavigate()
  const next = searchParams.get('next') || '/dashboard'

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      navigate(next)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Login failed. Check your credentials.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
      <Card className="overflow-hidden border-border/70 bg-zinc-950 text-zinc-50 dark:bg-zinc-900">
        <CardContent className="relative p-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(14,165,233,0.35),transparent_32%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.28),transparent_36%)]" />
          <div className="relative space-y-6">
            <div className="inline-flex rounded-2xl bg-white/10 p-3">
              <ShieldCheck className="size-6" />
            </div>
            <div className="space-y-3">
              <h1 className="text-4xl font-semibold tracking-tight">Sign in to the business workspace.</h1>
              <p className="text-sm leading-6 text-zinc-300">
                Access tenant operations, marketplace management, billing controls, and support workflows from one shell.
              </p>
            </div>
            <div className="grid gap-3">
              {['Persistent dark and light modes', 'Faster route-level loading', 'Cleaner operations-first navigation'].map((item) => (
                <div key={item} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-200">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="mx-auto w-full max-w-xl border-border/70 bg-card/90">
        <CardHeader className="space-y-3">
          <CardTitle className="text-3xl">Welcome back</CardTitle>
          <CardDescription>
            Use your organization account to enter the new Mashora control shell.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {error ? <Notice tone="danger">{error}</Notice> : null}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="team@company.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="Enter your password"
              />
            </div>
            <Button type="submit" className="w-full rounded-2xl" size="lg" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign in'}
              {!loading ? <ArrowRight className="size-4" /> : null}
            </Button>
          </form>

          <div className="rounded-2xl border border-border/70 bg-muted/50 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">Demo access</p>
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{demoEmail}</span>
                  {' / '}
                  <span className="font-medium text-foreground">{demoPassword}</span>
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEmail(demoEmail)
                  setPassword(demoPassword)
                }}
              >
                Use demo login
              </Button>
            </div>
          </div>

          <p className="text-center text-sm text-muted-foreground">
            No account yet?{' '}
            <Link to="/register" className="font-semibold text-foreground underline-offset-4 hover:underline">
              Create one
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
