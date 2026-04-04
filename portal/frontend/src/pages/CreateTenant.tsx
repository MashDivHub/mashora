import { useState, type FormEvent } from 'react'
import { ArrowLeft, DatabaseZap } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { createTenant } from '../api/tenants'
import { Notice } from '@/components/app/notice'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function CreateTenant() {
  const [dbName, setDbName] = useState('')
  const [subdomain, setSubdomain] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await createTenant(dbName, subdomain)
      navigate('/dashboard')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create tenant. Please try again.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <Button asChild variant="ghost" className="w-fit rounded-full px-0 hover:bg-transparent">
        <Link to="/dashboard">
          <ArrowLeft className="size-4" />
          Back to dashboard
        </Link>
      </Button>

      <Card className="border-border/70 bg-card/90">
        <CardHeader className="space-y-3">
          <div className="inline-flex w-fit rounded-2xl border border-border/70 bg-muted/60 p-3">
            <DatabaseZap className="size-5" />
          </div>
          <div className="space-y-2">
            <CardTitle className="text-3xl">Create a new tenant instance</CardTitle>
            <CardDescription>
              Provision an isolated workspace with a clean database name and customer-facing subdomain.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {error ? <Notice tone="danger">{error}</Notice> : null}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="dbName">Database name</Label>
              <Input
                id="dbName"
                type="text"
                value={dbName}
                onChange={(e) => setDbName(e.target.value)}
                placeholder="acme_corp"
                pattern="^[a-z][a-z0-9_]*$"
                required
              />
              <p className="text-sm text-muted-foreground">Use lowercase letters, numbers, and underscores only.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="subdomain">Subdomain</Label>
              <Input
                id="subdomain"
                type="text"
                value={subdomain}
                onChange={(e) => setSubdomain(e.target.value)}
                placeholder="acme"
                pattern="^[a-z][a-z0-9-]*$"
                required
              />
              <p className="text-sm text-muted-foreground">
                Customer URL preview: <span className="font-medium text-foreground">{subdomain || 'your-subdomain'}.mashora.app</span>
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => navigate('/dashboard')}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading} className="rounded-2xl">
                {loading ? 'Creating instance...' : 'Create instance'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
