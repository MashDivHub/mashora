import { ArrowRight, LayoutGrid, LockKeyhole, Orbit, Sparkles, Zap } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const features = [
  {
    icon: LayoutGrid,
    title: 'Multi-tenant architecture',
    description: 'Provision isolated ERP workspaces for every customer without losing central governance.',
  },
  {
    icon: Zap,
    title: 'Fast provisioning',
    description: 'Spin up new tenant databases and operational environments in minutes instead of days.',
  },
  {
    icon: Orbit,
    title: 'Unified control plane',
    description: 'Keep billing, upgrades, support, and marketplace operations in one coordinated shell.',
  },
  {
    icon: LockKeyhole,
    title: 'Secure by default',
    description: 'Built-in token auth, tenant separation, and operational controls for serious business teams.',
  },
]

const primaryCtaStyle = {
  backgroundColor: '#fafafa',
  color: '#09090b',
  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.18)',
}

export default function Home() {
  return (
    <div className="space-y-12">
      <section className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
        <div className="space-y-8">
          <Badge variant="outline" className="rounded-full px-4 py-1 text-[11px] uppercase tracking-[0.28em]">
            Zinc Workspace
          </Badge>
          <div className="space-y-5">
            <h1 className="max-w-4xl text-5xl font-semibold tracking-tight text-foreground sm:text-6xl">
              A sharper business shell for tenants, operations, and CRM delivery.
            </h1>
            <p className="max-w-2xl text-lg text-muted-foreground">
              Mashora gives teams a cleaner way to provision tenants, manage subscriptions, run upgrades,
              curate addons, and support customers without the usual admin-panel clutter.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/register"
              style={primaryCtaStyle}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl px-6 text-sm font-semibold transition-all hover:brightness-95"
            >
              Start building
              <ArrowRight className="size-4" />
            </Link>
            <Button asChild variant="outline" size="lg" className="rounded-2xl">
              <Link to="/addons">Explore marketplace</Link>
            </Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              ['50+', 'Platform controls'],
              ['10x', 'Cleaner than stock admin'],
              ['1', 'Unified workspace'],
            ].map(([value, label]) => (
              <div key={label} className="rounded-3xl border border-border/70 bg-card/80 p-5 shadow-sm">
                <div className="text-3xl font-semibold tracking-tight">{value}</div>
                <div className="mt-2 text-sm text-muted-foreground">{label}</div>
              </div>
            ))}
          </div>
        </div>

        <Card className="overflow-hidden border-border/70 bg-zinc-950 text-zinc-50 dark:bg-zinc-900">
          <CardContent className="relative p-0">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(14,165,233,0.35),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.28),transparent_36%)]" />
            <div className="relative space-y-5 p-8">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-zinc-100">Executive control room</p>
                  <p className="text-sm text-zinc-400">Operations, billing, support, publisher, upgrades.</p>
                </div>
                <div className="rounded-2xl bg-white/10 p-3">
                  <Sparkles className="size-5" />
                </div>
              </div>

              <div className="grid gap-3">
                {[
                  ['Provisioning', '12 active workspaces', 'sky'],
                  ['Subscriptions', '4 plans in rotation', 'emerald'],
                  ['Support', '7 tickets awaiting action', 'amber'],
                ].map(([label, value, tone]) => (
                  <div key={label} className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                    <div className="mb-2 text-xs uppercase tracking-[0.22em] text-zinc-400">{label}</div>
                    <div className="flex items-center justify-between">
                      <div className="text-lg font-semibold text-white">{value}</div>
                      <div
                        className={`size-3 rounded-full ${
                          tone === 'sky' ? 'bg-sky-400' : tone === 'emerald' ? 'bg-emerald-400' : 'bg-amber-400'
                        }`}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <div className="mb-3 text-xs uppercase tracking-[0.22em] text-zinc-400">Why teams switch</div>
                <ul className="space-y-3 text-sm text-zinc-300">
                  <li>Cleaner navigation and clearer hierarchy than legacy ERP shells.</li>
                  <li>Route-level loading so pages stop shipping the whole app upfront.</li>
                  <li>Dark and light modes with one token system instead of ad hoc CSS.</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {features.map(({ icon: Icon, title, description }) => (
          <Card key={title} className="group bg-card/85 transition-transform duration-300 hover:-translate-y-1">
            <CardContent className="space-y-4 p-6">
              <div className="inline-flex rounded-2xl border border-border/70 bg-muted/60 p-3 text-zinc-900 transition-colors group-hover:bg-zinc-900 group-hover:text-white dark:text-zinc-100 dark:group-hover:bg-zinc-100 dark:group-hover:text-zinc-900">
                <Icon className="size-5" />
              </div>
              <div className="space-y-2">
                <h2 className="text-lg font-semibold">{title}</h2>
                <p className="text-sm leading-6 text-muted-foreground">{description}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  )
}
