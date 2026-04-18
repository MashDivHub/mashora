import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Input, Button, Skeleton, Switch, Tabs, TabsContent, TabsList, TabsTrigger, cn,
  Label, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Badge,
} from '@mashora/design-system'
import { Settings, Save, Building2, Globe, Users, Shield, Mail, CreditCard, Package, Briefcase, Send, Server } from 'lucide-react'
import { FormField, FormSection, ReadonlyField, toast } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'
import { extractErrorMessage } from '@/lib/errors'

const asStr = (v: unknown): string => {
  if (v == null || v === false) return ''
  if (typeof v === 'string') return v
  if (typeof v === 'number') return String(v)
  return ''
}

interface MailServer {
  id: number
  name: string
  smtp_host: string
  smtp_port: number
  smtp_encryption: string
  smtp_user: string | false
  active: boolean
  sequence: number
}

export default function GeneralSettings() {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<Record<string, unknown>>({})
  const [dirty, setDirty] = useState(false)
  const [testOpen, setTestOpen] = useState(false)
  const [testEmail, setTestEmail] = useState('')
  const [testBusy, setTestBusy] = useState(false)

  const { data: mailServers, isLoading: serversLoading } = useQuery({
    queryKey: ['mail-servers'],
    queryFn: async () => {
      try {
        const { data } = await erpClient.raw.get('/email/servers')
        return (data?.records || data || []) as MailServer[]
      } catch {
        return [] as MailServer[]
      }
    },
    staleTime: 60_000,
  })

  async function handleSendTest() {
    if (!testEmail.trim()) { toast.error('Recipient required'); return }
    setTestBusy(true)
    try {
      await erpClient.raw.post('/email/test', { to: testEmail.trim() })
      toast.success('Test email sent', `Sent to ${testEmail}`)
      setTestOpen(false)
      setTestEmail('')
    } catch (e: unknown) {
      toast.error('Send failed', extractErrorMessage(e))
    } finally { setTestBusy(false) }
  }

  const { data, isLoading } = useQuery({
    queryKey: ['settings', 'open'],
    queryFn: async () => {
      const { data } = await erpClient.raw.post('/settings/open')
      return data
    },
  })

  const record: Record<string, unknown> = data?.data || {}
  const settingsId = data?.id

  useEffect(() => {
    if (record && Object.keys(record).length > 0) setForm({ ...record })
  }, [data])

  const setField = (name: string, value: unknown) => {
    setForm(prev => ({ ...prev, [name]: value }))
    setDirty(true)
  }

  const saveMut = useMutation({
    mutationFn: async () => {
      const vals: Record<string, unknown> = {}
      for (const key of Object.keys(form)) {
        if (form[key] !== record[key]) vals[key] = form[key]
      }
      await erpClient.raw.post('/settings/apply', { id: settingsId, vals })
    },
    onSuccess: () => {
      setDirty(false)
      toast.success('Settings Saved', 'General settings applied successfully')
      queryClient.invalidateQueries({ queryKey: ['settings'] })
    },
    onError: (e: unknown) => {
      toast.error('Save Failed', extractErrorMessage(e))
    },
  })

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-4xl">
        <Skeleton className="h-10 w-64 rounded-xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    )
  }

  const m2oVal = (v: unknown): string => {
    if (Array.isArray(v)) return String(v[1] ?? '')
    return asStr(v)
  }

  const ToggleField = ({ field, label, desc }: { field: string; label: string; desc?: string }) => (
    <div className="flex items-center justify-between py-2">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {desc && <p className="text-xs text-muted-foreground">{desc}</p>}
      </div>
      <Switch checked={!!form[field]} onCheckedChange={v => setField(field, v)} />
    </div>
  )

  const TF = ({ field, label, type = 'text' }: { field: string; label: string; type?: string }) => (
    <FormField label={label}>
      <Input type={type} value={asStr(form[field])} onChange={e => setField(field, e.target.value)} className="rounded-xl h-9" />
    </FormField>
  )

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-3">
            <Settings className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">Configuration</p>
            <h1 className="text-xl font-semibold tracking-tight">General Settings</h1>
          </div>
        </div>
        <Button size="sm" className="rounded-xl gap-1.5 shadow-sm" onClick={() => saveMut.mutate()} disabled={!dirty || saveMut.isPending}>
          <Save className="h-3.5 w-3.5" /> {saveMut.isPending ? 'Applying...' : 'Apply'}
        </Button>
      </div>

      {/* Settings tabs */}
      <Tabs defaultValue="company">
        <TabsList className="bg-muted/30 border border-border/30 rounded-xl p-1 h-auto flex-wrap">
          <TabsTrigger value="company" className="rounded-lg text-sm py-1.5 px-4 gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Building2 className="h-3.5 w-3.5" /> Company
          </TabsTrigger>
          <TabsTrigger value="users" className="rounded-lg text-sm py-1.5 px-4 gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Users className="h-3.5 w-3.5" /> Users
          </TabsTrigger>
          <TabsTrigger value="invoicing" className="rounded-lg text-sm py-1.5 px-4 gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <CreditCard className="h-3.5 w-3.5" /> Invoicing
          </TabsTrigger>
          <TabsTrigger value="inventory" className="rounded-lg text-sm py-1.5 px-4 gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Package className="h-3.5 w-3.5" /> Inventory
          </TabsTrigger>
          <TabsTrigger value="crm" className="rounded-lg text-sm py-1.5 px-4 gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Briefcase className="h-3.5 w-3.5" /> CRM
          </TabsTrigger>
          <TabsTrigger value="email" className="rounded-lg text-sm py-1.5 px-4 gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Mail className="h-3.5 w-3.5" /> Email
          </TabsTrigger>
        </TabsList>

        {/* Company */}
        <TabsContent value="company" className="mt-4 space-y-4">
          <div className="rounded-2xl border border-border/30 bg-card/50 p-6 space-y-4">
            <FormSection title="Company Information">
              <div className="grid md:grid-cols-2 gap-x-8 gap-y-3">
                <ReadonlyField label="Company Name" value={asStr(form.company_name)} />
                <ReadonlyField label="Country" value={m2oVal(form.account_fiscal_country_id)} />
                <ReadonlyField label="Currency" value={m2oVal(form.currency_id)} />
                <ReadonlyField label="Active Users" value={asStr(form.active_user_count)} />
              </div>
            </FormSection>
          </div>

          <div className="rounded-2xl border border-border/30 bg-card/50 p-6 space-y-4">
            <FormSection title="Language & Localization">
              <ReadonlyField label="Languages" value={`${form.language_count || 1} installed`} />
              <ToggleField field="auth_signup_reset_password" label="Password Reset" desc="Allow users to reset their password from the login page" />
            </FormSection>
          </div>
        </TabsContent>

        {/* Users */}
        <TabsContent value="users" className="mt-4 space-y-4">
          <div className="rounded-2xl border border-border/30 bg-card/50 p-6 space-y-4">
            <FormSection title="Access & Authentication">
              <div className="space-y-1 divide-y divide-border/20">
                <ToggleField field="auth_signup_reset_password" label="Password Reset" desc="Allow users to reset their password from the login page" />
                <ReadonlyField label="Signup Policy" value={form.auth_signup_uninvited === 'b2b' ? 'On Invitation' : 'Free Signup'} />
                <ReadonlyField label="Active Users" value={asStr(form.active_user_count)} />
              </div>
            </FormSection>
          </div>
        </TabsContent>

        {/* Invoicing */}
        <TabsContent value="invoicing" className="mt-4 space-y-4">
          <div className="rounded-2xl border border-border/30 bg-card/50 p-6 space-y-4">
            <FormSection title="Invoicing Settings">
              <div className="space-y-1 divide-y divide-border/20">
                <ReadonlyField label="Tax Computation" value={form.account_price_include === 'tax_excluded' ? 'Tax Excluded' : 'Tax Included'} />
                <ReadonlyField label="Chart of Accounts" value={asStr(form.chart_template) || 'Default'} />
                <ReadonlyField label="Currency" value={m2oVal(form.currency_id)} />
                <ReadonlyField label="Fiscal Country" value={m2oVal(form.account_fiscal_country_id)} />
                <ToggleField field="autopost_bills" label="Auto-post Bills" desc="Automatically post vendor bills when confirmed" />
              </div>
            </FormSection>
          </div>
        </TabsContent>

        {/* Inventory */}
        <TabsContent value="inventory" className="mt-4 space-y-4">
          <div className="rounded-2xl border border-border/30 bg-card/50 p-6 space-y-4">
            <FormSection title="Inventory Settings">
              <div className="space-y-1 divide-y divide-border/20">
                <ReadonlyField label="Annual Inventory" value={`Day ${form.annual_inventory_day || 31}, Month ${form.annual_inventory_month || 12}`} />
                <ReadonlyField label="Barcode Separator" value={asStr(form.barcode_separator) || ','} />
              </div>
            </FormSection>
          </div>
        </TabsContent>

        {/* CRM */}
        <TabsContent value="crm" className="mt-4 space-y-4">
          <div className="rounded-2xl border border-border/30 bg-card/50 p-6 space-y-4">
            <FormSection title="CRM Settings">
              <div className="space-y-1 divide-y divide-border/20">
                <ReadonlyField label="Auto Assignment" value={form.crm_auto_assignment_action === 'manual' ? 'Manual' : 'Automatic'} />
                <ReadonlyField label="Assignment Interval" value={`Every ${form.crm_auto_assignment_interval_number || 1} ${form.crm_auto_assignment_interval_type || 'days'}`} />
              </div>
            </FormSection>
          </div>
        </TabsContent>

        {/* Email */}
        <TabsContent value="email" className="mt-4 space-y-4">
          <div className="rounded-2xl border border-border/30 bg-card/50 p-6 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <FormSection title="Outgoing Mail Servers">
                <p className="text-xs text-muted-foreground">SMTP servers used to send outgoing mail.</p>
              </FormSection>
              <Button size="sm" className="rounded-xl gap-1.5 shrink-0" onClick={() => setTestOpen(true)}>
                <Send className="h-3.5 w-3.5" /> Test Email
              </Button>
            </div>

            {serversLoading ? (
              <Skeleton className="h-20 rounded-xl" />
            ) : (mailServers || []).length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/40 px-4 py-8 text-center">
                <Server className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">No outgoing mail servers configured.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {(mailServers || []).map(s => (
                  <div key={s.id} className="rounded-xl border border-border/30 bg-background/40 px-4 py-3 flex items-center gap-3">
                    <Server className={cn('h-4 w-4 shrink-0', s.active ? 'text-emerald-400' : 'text-muted-foreground/40')} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{s.name || `Server #${s.id}`}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {s.smtp_host || '—'}:{s.smtp_port || 25}
                        {s.smtp_user ? ` · ${s.smtp_user}` : ''}
                        {s.smtp_encryption ? ` · ${s.smtp_encryption.toUpperCase()}` : ''}
                      </p>
                    </div>
                    <Badge variant={s.active ? 'default' : 'secondary'} className="rounded-full text-xs shrink-0">
                      {s.active ? 'Active' : 'Disabled'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={testOpen} onOpenChange={setTestOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-primary" /> Send Test Email
            </DialogTitle>
            <DialogDescription>
              Send a test message to verify your SMTP configuration is working.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="test-recipient">Recipient Email</Label>
            <Input id="test-recipient" type="email" value={testEmail}
              onChange={e => setTestEmail(e.target.value)}
              placeholder="you@example.com" autoFocus
              disabled={testBusy}
              onKeyDown={e => { if (e.key === 'Enter' && !testBusy) handleSendTest() }} />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setTestOpen(false)} disabled={testBusy}>Cancel</Button>
            <Button onClick={handleSendTest} disabled={testBusy || !testEmail.trim()}>
              {testBusy ? 'Sending...' : 'Send Test'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
