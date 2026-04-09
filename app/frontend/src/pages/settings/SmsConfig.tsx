import { useQuery } from '@tanstack/react-query'
import { Skeleton } from '@mashora/design-system'
import { MessageSquare, Info } from 'lucide-react'
import { PageHeader, FormSection, ReadonlyField } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'

function maskSecret(val: string | null | undefined): string {
  if (!val) return 'Not configured'
  return val.slice(0, 4) + '••••••••'
}

const SMS_USAGES = [
  'CRM notifications',
  'HR leave alerts',
  'Event reminders',
  'Survey invitations',
]

export default function SmsConfig() {
  const { data, isLoading } = useQuery({
    queryKey: ['settings', 'sms'],
    queryFn: async () => {
      try {
        const { data } = await erpClient.raw.post('/model/iap.account', {
          domain: [['provider', '=', 'sms']],
          fields: ['id', 'account_token', 'company_id'],
          limit: 1,
        })
        return (data?.data?.[0] ?? data?.[0]) || null
      } catch {
        return null
      }
    },
  })

  const accountToken: string | undefined = data?.account_token
  const isConfigured = !!accountToken

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-3xl">
        <Skeleton className="h-10 w-64 rounded-xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
        <Skeleton className="h-36 w-full rounded-2xl" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title="SMS Configuration"
        subtitle="Twilio SMS gateway"
        backTo="/settings"
      />

      {/* Status card */}
      <div className="rounded-2xl border border-border/30 bg-card/50 p-6 space-y-4">
        <FormSection title="Integration Status">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-primary/10 p-2.5">
              <MessageSquare className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-muted-foreground mb-1.5">
                Twilio SMS gateway for automated notifications and alerts
              </p>
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  isConfigured
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-muted text-muted-foreground border border-border/30'
                }`}
              >
                {isConfigured ? 'Configured' : 'Not Configured'}
              </span>
            </div>
          </div>
        </FormSection>
      </div>

      {/* Configuration card */}
      <div className="rounded-2xl border border-border/30 bg-card/50 p-6 space-y-4">
        <FormSection title="Twilio Credentials">
          <div className="space-y-3 divide-y divide-border/20">
            <ReadonlyField label="Account SID" value={maskSecret(accountToken)} />
            <div className="pt-3">
              <ReadonlyField label="Auth Token" value={maskSecret(undefined)} />
            </div>
            <div className="pt-3">
              <ReadonlyField label="Phone Number" value="Not configured" />
            </div>
          </div>
        </FormSection>
      </div>

      {/* Usage info card */}
      <div className="rounded-2xl border border-border/30 bg-card/50 p-6 space-y-4">
        <FormSection title="SMS is used for">
          <div className="space-y-0 divide-y divide-border/20">
            {SMS_USAGES.map(usage => (
              <div key={usage} className="flex items-center gap-2.5 py-2">
                <div className="h-1.5 w-1.5 rounded-full bg-primary/60 shrink-0" />
                <span className="text-sm">{usage}</span>
              </div>
            ))}
          </div>
        </FormSection>
      </div>

      {/* Note card */}
      <div className="rounded-2xl border border-border/30 bg-card/50 p-6">
        <div className="flex items-start gap-3">
          <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
          <p className="text-sm text-muted-foreground">
            SMS credits are managed through the{' '}
            <span className="text-foreground font-medium">
              Mashora IAP (In-App Purchase)
            </span>{' '}
            service. Configure Twilio credentials in your backend IAP account settings.
          </p>
        </div>
      </div>
    </div>
  )
}
