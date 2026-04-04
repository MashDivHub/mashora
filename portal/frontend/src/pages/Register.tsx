import { useState, type FormEvent } from 'react'
import { Building2, UserRoundPlus } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { register } from '../api/auth'
import { Notice } from '@/components/app/notice'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function Register() {
  const [orgName, setOrgName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    try {
      await register(email, password, orgName)
      navigate('/login')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Registration failed. Please try again.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[0.88fr_1.12fr] lg:items-center">
      <Card className="border-border/70 bg-card/85">
        <CardContent className="space-y-6 p-8">
          <div className="inline-flex rounded-2xl border border-border/70 bg-muted/60 p-3 text-zinc-900 dark:text-zinc-100">
            <Building2 className="size-6" />
          </div>
          <div className="space-y-3">
            <h1 className="text-4xl font-semibold tracking-tight">Create your company workspace.</h1>
            <p className="text-sm leading-6 text-muted-foreground">
              Launch a tenant-ready organization account and start managing billing, upgrades, support, and marketplace operations from one place.
            </p>
          </div>
          <div className="grid gap-3">
            {['Organization-level access control', 'Cleaner lifecycle from sign-up to provisioning', 'Ready for dark and light work modes'].map((item) => (
              <div key={item} className="rounded-2xl border border-border/70 bg-background/60 px-4 py-3 text-sm text-muted-foreground">
                {item}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="mx-auto w-full max-w-2xl border-border/70 bg-card/90">
        <CardHeader className="space-y-3">
          <CardTitle className="text-3xl">Create account</CardTitle>
          <CardDescription>Register your organization and enter the new Mashora workspace.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {error ? <Notice tone="danger">{error}</Notice> : null}

          <form onSubmit={handleSubmit} className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="orgName">Organization name</Label>
              <Input
                id="orgName"
                type="text"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                required
                autoComplete="organization"
                placeholder="Mashora Labs"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="registerEmail">Email</Label>
              <Input
                id="registerEmail"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="ops@company.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="registerPassword">Password</Label>
              <Input
                id="registerPassword"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
                placeholder="Create a password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
                placeholder="Repeat your password"
              />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" className="w-full rounded-2xl" size="lg" disabled={loading}>
                <UserRoundPlus className="size-4" />
                {loading ? 'Creating account...' : 'Create account'}
              </Button>
            </div>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-foreground underline-offset-4 hover:underline">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
