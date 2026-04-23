import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Badge, Button, Card, CardContent, Skeleton } from '@mashora/design-system'
import { MessageSquare, Info, BellRing, Plus } from 'lucide-react'
import { PageHeader } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'

interface IapAccount {
  id: number
  account_token: string | null
  service_name: string
}

const SMS_USAGES = [
  { label: 'CRM lead notifications', model: 'crm.lead' },
  { label: 'HR leave alerts', model: 'hr.leave' },
  { label: 'Event reminders', model: 'event.event' },
  { label: 'Survey invitations', model: 'survey.user_input' },
  { label: 'Marketing campaigns', model: 'mailing.mailing (SMS type)' },
]

export default function SmsConfig() {
  const navigate = useNavigate()
  const { data, isLoading } = useQuery({
    queryKey: ['settings', 'sms-iap'],
    queryFn: async () => {
      try {
        const { data } = await erpClient.raw.post('/model/iap.account', {
          domain: [['service_name', '=', 'sms']],
          fields: ['id', 'account_token', 'service_name'],
          limit: 1,
        })
        return (data?.records?.[0] || null) as IapAccount | null
      } catch {
        return null
      }
    },
  })

  const configured = !!data?.account_token

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-3xl">
        <Skeleton className="h-10 w-64 rounded-xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader title="SMS Gateway" subtitle="Mashora IAP" backTo="/admin/settings" />

      <Card className="rounded-2xl">
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-start gap-4">
            <div className="rounded-xl bg-primary/10 p-3 shrink-0">
              <MessageSquare className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold mb-1">SMS Service</h3>
              <p className="text-sm text-muted-foreground mb-3">Send transactional SMS messages from any module via Mashora's IAP gateway.</p>
              <Badge className={configured ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-xs' : 'bg-muted text-muted-foreground border-border/30 text-xs'}>
                {configured ? 'Account active' : 'Not configured'}
              </Badge>
            </div>
          </div>

          {!configured && (
            <div className="mt-5 pt-5 border-t border-border/40 space-y-3">
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-sm text-amber-600 dark:text-amber-400">
                No SMS account found. Set up an <code className="font-mono">iap.account</code> with <code className="font-mono">service_name='sms'</code> and credits to enable SMS sending.
              </div>
              <Button
                onClick={() => navigate('/admin/model/iap.account/new')}
                className="rounded-xl gap-2"
              >
                <Plus className="h-4 w-4" /> Create IAP Account
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardContent className="p-4 sm:p-6">
          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2"><BellRing className="h-4 w-4" /> Used by modules</h4>
          <div className="space-y-1">
            {SMS_USAGES.map(u => (
              <div key={u.model} className="flex items-center justify-between py-2 border-b border-border/20 last:border-0">
                <span className="text-sm">{u.label}</span>
                <code className="text-xs text-muted-foreground font-mono">{u.model}</code>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-start gap-3">
            <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <div className="text-sm text-muted-foreground space-y-2">
              <p>SMS uses Mashora's IAP (In-App Purchase) credit system. To send SMS:</p>
              <ol className="list-decimal pl-4 space-y-1 text-xs">
                <li>Create an <code className="font-mono">iap.account</code> with <code className="font-mono">service_name='sms'</code></li>
                <li>Top up credits via the IAP portal</li>
                <li>Optionally configure a custom SMS provider (Twilio, AWS SNS) via environment variables</li>
              </ol>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
