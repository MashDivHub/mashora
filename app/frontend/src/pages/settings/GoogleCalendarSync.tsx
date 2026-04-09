import { useQuery } from '@tanstack/react-query'
import { Skeleton } from '@mashora/design-system'
import { Calendar, Info } from 'lucide-react'
import { PageHeader, FormSection, ReadonlyField } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'

function maskSecret(val: string | null | undefined): string {
  if (!val) return 'Not configured'
  return val.slice(0, 4) + '••••••••'
}

export default function GoogleCalendarSync() {
  const { data, isLoading } = useQuery({
    queryKey: ['settings', 'google-calendar'],
    queryFn: async () => {
      try {
        const { data } = await erpClient.raw.post('/model/res.config.settings', {
          fields: ['id', 'cal_client_id', 'cal_client_secret'],
          limit: 1,
          order: 'id desc',
        })
        return (data?.data?.[0] ?? data?.[0]) || null
      } catch {
        return null
      }
    },
  })

  const clientId: string | undefined = data?.cal_client_id
  const clientSecret: string | undefined = data?.cal_client_secret
  const isConnected = !!(clientId && clientSecret)

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-3xl">
        <Skeleton className="h-10 w-64 rounded-xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title="Google Calendar"
        subtitle="Integration settings"
        backTo="/settings"
      />

      {/* Status card */}
      <div className="rounded-2xl border border-border/30 bg-card/50 p-6 space-y-4">
        <FormSection title="Integration Status">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-primary/10 p-2.5">
              <Calendar className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-muted-foreground mb-1.5">
                Synchronize your Google Calendar events with Mashora calendar
              </p>
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  isConnected
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-muted text-muted-foreground border border-border/30'
                }`}
              >
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          </div>
        </FormSection>
      </div>

      {/* Configuration card */}
      <div className="rounded-2xl border border-border/30 bg-card/50 p-6 space-y-4">
        <FormSection title="Configuration">
          <div className="space-y-3 divide-y divide-border/20">
            <ReadonlyField label="Client ID" value={maskSecret(clientId)} />
            <div className="pt-3">
              <ReadonlyField label="Client Secret" value={maskSecret(clientSecret)} />
            </div>
            <div className="pt-3">
              <ReadonlyField
                label="Sync Direction"
                value="One-way (Google → Mashora)"
              />
            </div>
          </div>
        </FormSection>
      </div>

      {/* Note card */}
      <div className="rounded-2xl border border-border/30 bg-card/50 p-6">
        <div className="flex items-start gap-3">
          <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
          <p className="text-sm text-muted-foreground">
            Configure Google OAuth credentials in{' '}
            <span className="text-foreground font-medium">
              Settings → General → Integrations tab
            </span>
          </p>
        </div>
      </div>
    </div>
  )
}
