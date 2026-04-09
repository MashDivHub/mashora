import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Input, Button, Skeleton, Switch, Tabs, TabsContent, TabsList, TabsTrigger, cn } from '@mashora/design-system'
import { Settings, Save, Building2, Globe, Users, Shield, Mail, CreditCard, Package, Briefcase } from 'lucide-react'
import { FormField, FormSection, ReadonlyField, toast } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'

export default function GeneralSettings() {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<Record<string, any>>({})
  const [dirty, setDirty] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['settings', 'open'],
    queryFn: async () => {
      const { data } = await erpClient.raw.post('/settings/open')
      return data
    },
  })

  const record = data?.data || {}
  const settingsId = data?.id

  useEffect(() => {
    if (record && Object.keys(record).length > 0) setForm({ ...record })
  }, [data])

  const setField = (name: string, value: any) => {
    setForm(prev => ({ ...prev, [name]: value }))
    setDirty(true)
  }

  const saveMut = useMutation({
    mutationFn: async () => {
      const vals: Record<string, any> = {}
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
    onError: (e: any) => {
      toast.error('Save Failed', e?.response?.data?.detail || e.message || 'Unknown error')
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

  const m2oVal = (v: any) => Array.isArray(v) ? v[1] : (v || '')

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
      <Input type={type} value={form[field] || ''} onChange={e => setField(field, e.target.value)} className="rounded-xl h-9" />
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
        </TabsList>

        {/* Company */}
        <TabsContent value="company" className="mt-4 space-y-4">
          <div className="rounded-2xl border border-border/30 bg-card/50 p-6 space-y-4">
            <FormSection title="Company Information">
              <div className="grid md:grid-cols-2 gap-x-8 gap-y-3">
                <ReadonlyField label="Company Name" value={form.company_name} />
                <ReadonlyField label="Country" value={m2oVal(form.account_fiscal_country_id)} />
                <ReadonlyField label="Currency" value={m2oVal(form.currency_id)} />
                <ReadonlyField label="Active Users" value={form.active_user_count} />
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
                <ReadonlyField label="Active Users" value={form.active_user_count} />
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
                <ReadonlyField label="Chart of Accounts" value={form.chart_template || 'Default'} />
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
                <ReadonlyField label="Barcode Separator" value={form.barcode_separator || ','} />
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
      </Tabs>
    </div>
  )
}
