import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Card, CardContent, Skeleton } from '@mashora/design-system'
import { Calendar, Info, Link as LinkIcon, Unplug } from 'lucide-react'
import { PageHeader, toast } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'
import { extractErrorMessage } from '@/lib/errors'

interface SyncStatus {
  google: { configured: boolean; connected: boolean; last_sync: string | null }
  microsoft: { configured: boolean; connected: boolean; last_sync: string | null }
}

export default function MicrosoftCalendarSync() {
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['calendar-sync-status'],
    queryFn: async () => {
      const { data } = await erpClient.raw.get('/calendar-sync/status')
      return data as SyncStatus
    },
  })

  const connectMut = useMutation({
    mutationFn: async () => {
      const { data } = await erpClient.raw.get('/calendar-sync/microsoft/auth-url')
      return data as { auth_url: string }
    },
    onSuccess: ({ auth_url }) => { window.location.href = auth_url },
    onError: (e: unknown) => toast.error(extractErrorMessage(e, 'Microsoft Calendar not configured. Set MICROSOFT_CALENDAR_CLIENT_ID and MICROSOFT_CALENDAR_CLIENT_SECRET in backend .env.')),
  })

  const disconnectMut = useMutation({
    mutationFn: async () => { await erpClient.raw.post('/calendar-sync/disconnect/microsoft') },
    onSuccess: () => { toast.success('Microsoft Calendar disconnected'); qc.invalidateQueries({ queryKey: ['calendar-sync-status'] }) },
    onError: () => toast.error('Failed to disconnect'),
  })

  const status = data?.microsoft
  const connected = !!status?.connected
  const configured = !!status?.configured

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
      <PageHeader title="Microsoft Calendar" subtitle="Integration" backTo="/admin/settings" />

      <Card className="rounded-2xl">
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-start gap-4">
            <div className="rounded-xl bg-primary/10 p-3 shrink-0">
              <Calendar className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold mb-1">Outlook Calendar Sync</h3>
              <p className="text-sm text-muted-foreground mb-3">Two-way synchronization between your Microsoft Outlook calendar and Mashora.</p>
              <div className="flex items-center gap-2 mb-3">
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${connected ? 'bg-emerald-500/10 text-emerald-500' : configured ? 'bg-amber-500/10 text-amber-500' : 'bg-muted text-muted-foreground'}`}>
                  {connected ? 'Connected' : configured ? 'Ready to connect' : 'Not configured'}
                </span>
                {status?.last_sync && (
                  <span className="text-xs text-muted-foreground">Last sync: {new Date(status.last_sync).toLocaleString()}</span>
                )}
              </div>
              {!configured && (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-600 dark:text-amber-400">
                  <strong>Setup required:</strong> Add <code className="font-mono">MICROSOFT_CALENDAR_CLIENT_ID</code>, <code className="font-mono">MICROSOFT_CALENDAR_CLIENT_SECRET</code> and <code className="font-mono">MICROSOFT_CALENDAR_TENANT_ID</code> to backend <code className="font-mono">.env</code>.
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-2 mt-5 pt-5 border-t border-border/40">
            {connected ? (
              <Button variant="outline" className="rounded-xl" onClick={() => disconnectMut.mutate()} disabled={disconnectMut.isPending}>
                <Unplug className="h-4 w-4 mr-1.5" />
                {disconnectMut.isPending ? 'Disconnecting...' : 'Disconnect'}
              </Button>
            ) : (
              <Button className="rounded-xl" onClick={() => connectMut.mutate()} disabled={!configured || connectMut.isPending}>
                <LinkIcon className="h-4 w-4 mr-1.5" />
                {connectMut.isPending ? 'Redirecting...' : 'Connect with Microsoft'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-start gap-3">
            <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <div className="text-sm text-muted-foreground space-y-2">
              <p>To enable Microsoft Calendar sync:</p>
              <ol className="list-decimal pl-4 space-y-1 text-xs">
                <li>Register an application in Azure Portal → Microsoft Entra ID → App registrations</li>
                <li>Add Microsoft Graph API permissions: <code className="font-mono">Calendars.ReadWrite</code></li>
                <li>Create a client secret under Certificates & secrets</li>
                <li>Set client ID, secret and tenant ID in backend <code className="font-mono">.env</code></li>
                <li>Restart backend and click "Connect with Microsoft"</li>
              </ol>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
