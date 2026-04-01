import { type FormEvent, useEffect, useState } from 'react'
import { ArrowRight, CheckCircle2, LockKeyhole, Server } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getPreferredDatabase } from '@/store/auth-store'
import { listDatabases } from '@/services/erp/auth'
import { useErpSession } from '@/hooks/use-erp-session'

const featurePoints = [
  'Dark-first workspace with light mode support',
  'Generic list, kanban, and form surfaces backed by the live ERP',
  'Zero business logic rewrite on the backend',
]

export function LoginPage() {
  const navigate = useNavigate()
  const { status, error, login, clearError } = useErpSession()
  const [database, setDatabase] = useState(getPreferredDatabase())
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [databases, setDatabases] = useState<string[]>([])

  useEffect(() => {
    if (status === 'authenticated') {
      navigate('/app', { replace: true })
    }
  }, [navigate, status])

  useEffect(() => {
    void listDatabases()
      .then((items) => setDatabases(items))
      .catch(() => setDatabases([]))
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    clearError()
    const success = await login({
      db: database,
      login: username,
      password,
    })
    if (success) {
      navigate('/app', { replace: true })
    }
  }

  return (
    <div className="min-h-screen px-4 py-6 lg:px-8 lg:py-8">
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-[1480px] gap-6 lg:grid-cols-[1.1fr_520px]">
        <Card className="relative overflow-hidden">
          <CardContent className="flex h-full flex-col justify-between p-8 lg:p-10">
            <div>
              <Badge>ERP Frontend Rework</Badge>
              <h1 className="mt-6 max-w-[12ch] text-4xl font-semibold tracking-tight lg:text-6xl">
                A cleaner control surface for the same Mashora backend.
              </h1>
              <p className="mt-6 max-w-[56ch] text-base text-muted-foreground lg:text-lg">
                This workspace is the new frontend layer for the ERP: redesigned navigation,
                premium dark mode by default, light mode too, and reusable view primitives for
                every addon that shares the core ERP patterns.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {featurePoints.map((point) => (
                <div key={point} className="rounded-[24px] border border-border/60 bg-card/60 p-4">
                  <CheckCircle2 className="mb-3 size-5 text-primary" />
                  <div className="text-sm text-muted-foreground">{point}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="self-center">
          <CardHeader className="space-y-4">
            <div className="flex size-14 items-center justify-center rounded-3xl bg-primary/12 text-primary">
              <LockKeyhole className="size-6" />
            </div>
            <div>
              <div className="text-sm font-medium text-primary">Secure ERP access</div>
              <CardTitle className="mt-2 text-3xl">Sign into Mashora</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <form className="space-y-5" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="database">Database</Label>
                {databases.length > 0 ? (
                  <select
                    id="database"
                    className="flex h-11 w-full rounded-2xl border border-input bg-background/80 px-3 py-2 text-sm outline-none ring-offset-background focus:border-ring focus:ring-2 focus:ring-ring/20"
                    value={database}
                    onChange={(event) => setDatabase(event.target.value)}
                    required
                  >
                    <option value="">Select a database</option>
                    {databases.map((db) => (
                      <option key={db} value={db}>
                        {db}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Input
                    id="database"
                    value={database}
                    onChange={(event) => setDatabase(event.target.value)}
                    placeholder="mashora_demo"
                    required
                  />
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="username">Email or username</Label>
                <Input
                  id="username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="admin@example.com"
                  autoComplete="username"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                />
              </div>

              {error ? (
                <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-3 py-3 text-sm text-red-400">
                  {error}
                </div>
              ) : null}

              <Button type="submit" className="w-full" disabled={status === 'loading'}>
                {status === 'loading' ? 'Signing in...' : 'Open ERP workspace'}
                <ArrowRight className="size-4" />
              </Button>

              <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-card/50 px-4 py-3 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Server className="size-4" />
                  Live ERP session bridge
                </div>
                <Badge variant="outline">JSON-RPC</Badge>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
