import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { Input, Textarea, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Badge, Button, Skeleton, cn } from '@mashora/design-system'
import { Building2, User, Star, BarChart3, FileText, Calendar, CheckSquare, ShoppingCart, Truck, CreditCard, Users } from 'lucide-react'
import { RecordForm, FormField, FormSection, ReadonlyField, StatusBar, toast, type SmartButton, type FormTab } from '@/components/shared'
import Chatter from '@/components/Chatter'
import { erpClient } from '@/lib/erp-api'
import { sanitizedHtml } from '@/lib/sanitize'

const FORM_FIELDS = [
  'id', 'name', 'display_name', 'email', 'phone', 'mobile', 'website',
  'street', 'street2', 'city', 'state_id', 'zip', 'country_id',
  'is_company', 'company_type', 'parent_id', 'function', 'title',
  'category_id', 'comment', 'vat', 'lang', 'barcode',
  'image_1920', 'image_128',
  'customer_rank', 'supplier_rank', 'active',
  'property_payment_term_id', 'property_supplier_payment_term_id',
  'property_account_position_id', 'property_product_pricelist',
  'property_purchase_currency_id',
  'opportunity_count', 'sale_order_count', 'meeting_count', 'task_count',
  'purchase_order_count', 'supplier_invoice_count',
  'credit', 'debit', 'total_invoiced',
  'child_ids',
]

export default function ContactForm() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isNew = !id || id === 'new'
  const recordId = isNew ? null : parseInt(id || '0')
  const [editing, setEditing] = useState(isNew)
  const [form, setForm] = useState<Record<string, any>>({})
  const [dirty, setDirty] = useState(false)

  // Load record
  const { data: record, isLoading } = useQuery({
    queryKey: ['contact', recordId],
    queryFn: async () => {
      if (isNew) {
        const { data } = await erpClient.raw.post('/model/res.partner/defaults', { fields: FORM_FIELDS })
        return { ...data, id: null, is_company: false, company_type: 'person' }
      }
      const { data } = await erpClient.raw.get(`/model/res.partner/${recordId}`)
      return data
    },
  })

  useEffect(() => {
    if (record) { setForm({ ...record }); setDirty(false) }
  }, [record])

  const setField = useCallback((name: string, value: any) => {
    setForm(prev => ({ ...prev, [name]: value }))
    setDirty(true)
  }, [])

  // Validation
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validate = useCallback((): boolean => {
    const errs: Record<string, string> = {}
    if (!form.name?.trim()) errs.name = 'Name is required'
    setErrors(errs)
    if (Object.keys(errs).length > 0) {
      toast.error('Validation Error', Object.values(errs).join(', '))
      return false
    }
    return true
  }, [form])

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!validate()) throw new Error('Validation failed')
      const vals: Record<string, any> = {}
      const editableFields = [
        'name', 'email', 'phone', 'mobile', 'website', 'street', 'street2',
        'city', 'zip', 'is_company', 'company_type', 'function', 'vat',
        'comment', 'barcode', 'lang', 'image_1920',
        'customer_rank', 'supplier_rank',
      ]
      for (const f of editableFields) {
        if (form[f] !== record?.[f]) vals[f] = form[f]
      }
      // Relational fields — send ID only
      for (const f of ['parent_id', 'state_id', 'country_id', 'title', 'property_payment_term_id', 'property_supplier_payment_term_id', 'property_account_position_id', 'property_product_pricelist']) {
        const v = form[f]
        const orig = record?.[f]
        const newId = Array.isArray(v) ? v[0] : v
        const origId = Array.isArray(orig) ? orig[0] : orig
        if (newId !== origId) vals[f] = newId || false
      }
      // Tags
      if (JSON.stringify(form.category_id) !== JSON.stringify(record?.category_id)) {
        const ids = (form.category_id || []).map((t: any) => Array.isArray(t) ? t[0] : typeof t === 'object' ? t.id : t)
        vals.category_id = [[6, 0, ids]]
      }

      if (isNew) {
        const { data } = await erpClient.raw.post('/model/res.partner/create', { vals: { ...form, ...vals } })
        return data
      } else {
        const { data } = await erpClient.raw.put(`/model/res.partner/${recordId}`, { vals })
        return data
      }
    },
    onSuccess: (data) => {
      setDirty(false)
      setEditing(false)
      setErrors({})
      toast.success('Saved', 'Contact saved successfully')
      queryClient.invalidateQueries({ queryKey: ['contact'] })
      queryClient.invalidateQueries({ queryKey: ['contacts'] })
      if (isNew && data?.id) {
        navigate(`/admin/contacts/${data.id}`, { replace: true })
      }
    },
    onError: (e: any) => {
      if (e.message !== 'Validation failed') {
        toast.error('Save Failed', e?.response?.data?.detail || e.message || 'Unknown error')
      }
    },
  })

  // Many2one search helper
  const [m2oResults, setM2oResults] = useState<Record<string, any[]>>({})
  const searchM2o = useCallback(async (model: string, query: string, field: string) => {
    if (!query) { setM2oResults(prev => ({ ...prev, [field]: [] })); return }
    try {
      const { data } = await erpClient.raw.post(`/model/${model}/name_search`, { name: query, limit: 8 })
      setM2oResults(prev => ({ ...prev, [field]: data.results || [] }))
    } catch { setM2oResults(prev => ({ ...prev, [field]: [] })) }
  }, [])

  if (isLoading || !record) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    )
  }

  const isCompany = form.is_company || form.company_type === 'company'
  const displayName = form.name || 'New Contact'
  const m2oDisplay = (val: any) => Array.isArray(val) ? val[1] : ''

  // Smart buttons
  const smartButtons: SmartButton[] = [
    form.opportunity_count > 0 && { label: 'Opportunities', value: form.opportunity_count, icon: <Star className="h-5 w-5" /> },
    form.sale_order_count > 0 && { label: 'Sales', value: form.sale_order_count, icon: <BarChart3 className="h-5 w-5" /> },
    form.total_invoiced > 0 && { label: 'Invoiced', value: `$${(form.total_invoiced || 0).toFixed(0)}`, icon: <FileText className="h-5 w-5" /> },
    form.meeting_count > 0 && { label: 'Meetings', value: form.meeting_count, icon: <Calendar className="h-5 w-5" /> },
    form.task_count > 0 && { label: 'Tasks', value: form.task_count, icon: <CheckSquare className="h-5 w-5" /> },
    form.purchase_order_count > 0 && { label: 'Purchases', value: form.purchase_order_count, icon: <ShoppingCart className="h-5 w-5" /> },
  ].filter(Boolean) as SmartButton[]

  // M2O field component
  const M2OField = ({ field, model, label, required }: { field: string; model: string; label: string; required?: boolean }) => {
    const [open, setOpen] = useState(false)
    const [q, setQ] = useState('')
    const results = m2oResults[field] || []

    if (!editing) return <ReadonlyField label={label} value={m2oDisplay(form[field])} />
    return (
      <FormField label={label} required={required}>
        <div className="relative">
          <Input
            value={open ? q : m2oDisplay(form[field])}
            onChange={e => { setQ(e.target.value); searchM2o(model, e.target.value, field) }}
            onFocus={() => { setQ(m2oDisplay(form[field])); setOpen(true) }}
            onBlur={() => setTimeout(() => setOpen(false), 200)}
            placeholder="Search..."
            className="rounded-xl h-9"
            autoComplete="off"
          />
          {open && results.length > 0 && (
            <div className="absolute z-50 mt-1 w-full rounded-xl border border-border/60 bg-popover shadow-lg max-h-48 overflow-y-auto">
              {results.map((r: any) => (
                <button
                  key={r.id}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-accent transition-colors first:rounded-t-xl last:rounded-b-xl"
                  onMouseDown={() => { setField(field, [r.id, r.display_name]); setOpen(false) }}
                >
                  {r.display_name}
                </button>
              ))}
            </div>
          )}
        </div>
      </FormField>
    )
  }

  // Editable input helper
  const TextField = ({ field, label, required, type = 'text' }: { field: string; label: string; required?: boolean; type?: string }) => {
    if (!editing) return <ReadonlyField label={label} value={form[field]} />
    return (
      <FormField label={label} required={required}>
        <Input type={type} value={form[field] || ''} onChange={e => setField(field, e.target.value)} className="rounded-xl h-9" />
      </FormField>
    )
  }

  // Tabs
  const tabs: FormTab[] = [
    {
      key: 'contacts',
      label: 'Contacts & Addresses',
      content: (
        <div className="space-y-3">
          {Array.isArray(form.child_ids) && form.child_ids.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {form.child_ids.slice(0, 12).map((child: any) => {
                const c = typeof child === 'object' ? child : { id: child }
                return (
                  <div
                    key={c.id}
                    className="rounded-xl border border-border/50 p-3 hover:bg-muted/20 cursor-pointer transition-colors"
                    onClick={() => navigate(`/admin/contacts/${c.id}`)}
                  >
                    <p className="text-sm font-medium">{c.name || c.display_name || `Contact #${c.id}`}</p>
                    {c.email && <p className="text-xs text-muted-foreground">{c.email}</p>}
                    {c.phone && <p className="text-xs text-muted-foreground">{c.phone}</p>}
                    {c.function && <p className="text-xs text-muted-foreground">{c.function}</p>}
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-4 text-center">No contacts or addresses</p>
          )}
          {!isNew && editing && (
            <Button variant="outline" size="sm" className="rounded-xl" onClick={() => navigate(`/admin/contacts/new?parent_id=${recordId}`)}>
              Add Contact
            </Button>
          )}
        </div>
      ),
    },
    {
      key: 'sales',
      label: 'Sales & Purchase',
      content: (
        <div className="grid md:grid-cols-2 gap-x-8 gap-y-2">
          <div className="space-y-2">
            <FormSection title="Sales">
              <M2OField field="property_payment_term_id" model="account.payment.term" label="Payment Terms" />
              <M2OField field="property_product_pricelist" model="product.pricelist" label="Pricelist" />
            </FormSection>
          </div>
          <div className="space-y-2">
            <FormSection title="Purchase">
              <M2OField field="property_supplier_payment_term_id" model="account.payment.term" label="Vendor Payment Terms" />
              <M2OField field="property_purchase_currency_id" model="res.currency" label="Supplier Currency" />
            </FormSection>
          </div>
        </div>
      ),
    },
    {
      key: 'accounting',
      label: 'Invoicing',
      hidden: !isCompany && !!form.parent_id,
      content: (
        <div className="grid md:grid-cols-2 gap-x-8 gap-y-2">
          <div className="space-y-2">
            <FormSection title="Bank Accounts">
              <p className="text-sm text-muted-foreground">
                {form.bank_account_count || 0} bank account(s)
              </p>
            </FormSection>
          </div>
          <div className="space-y-2">
            <FormSection title="Accounting Entries">
              <ReadonlyField label="Total Receivable" value={form.credit ? `$${form.credit.toFixed(2)}` : '$0.00'} />
              <ReadonlyField label="Total Payable" value={form.debit ? `$${form.debit.toFixed(2)}` : '$0.00'} />
              <ReadonlyField label="Total Invoiced" value={form.total_invoiced ? `$${form.total_invoiced.toFixed(2)}` : '$0.00'} />
            </FormSection>
          </div>
        </div>
      ),
    },
    {
      key: 'notes',
      label: 'Notes',
      content: (
        <div>
          {editing ? (
            <Textarea
              value={form.comment || ''}
              onChange={e => setField('comment', e.target.value)}
              rows={6}
              placeholder="Internal notes..."
              className="rounded-xl resize-y"
            />
          ) : (
            form.comment
              ? <div className="prose prose-sm dark:prose-invert max-w-none" dangerouslySetInnerHTML={sanitizedHtml(form.comment)} />
              : <p className="text-sm text-muted-foreground">No notes</p>
          )}
        </div>
      ),
    },
  ]

  return (
    <RecordForm
      title={displayName}
      editing={editing}
      onEdit={() => setEditing(true)}
      onSave={() => saveMutation.mutate()}
      onDiscard={() => { if (isNew) navigate(-1); else { setForm({ ...record }); setDirty(false); setEditing(false) } }}
      backTo="/admin/contacts"
      smartButtons={smartButtons}
      topContent={
        <div className="flex flex-col sm:flex-row gap-4 items-start mb-4">
          {/* Avatar */}
          <div className="shrink-0">
            {form.image_128 || form.image_1920 ? (
              <img
                src={`data:image/png;base64,${form.image_128 || form.image_1920}`}
                alt=""
                className="h-24 w-24 rounded-2xl object-cover"
              />
            ) : (
              <div className={cn(
                'h-24 w-24 rounded-2xl flex items-center justify-center text-2xl font-bold',
                isCompany ? 'bg-blue-500/15 text-blue-400' : 'bg-violet-500/15 text-violet-400',
              )}>
                {isCompany ? <Building2 className="h-10 w-10" /> : (form.name?.[0] || '?').toUpperCase()}
              </div>
            )}
          </div>

          {/* Key fields */}
          <div className="flex-1 space-y-2 min-w-0">
            {/* Company type toggle */}
            {editing && (
              <div className="flex gap-1 mb-1">
                <button
                  onClick={() => { setField('is_company', false); setField('company_type', 'person') }}
                  className={cn('rounded-lg px-3 py-1 text-xs font-medium transition-colors', !isCompany ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground')}
                >
                  <User className="h-3 w-3 inline mr-1" /> Individual
                </button>
                <button
                  onClick={() => { setField('is_company', true); setField('company_type', 'company') }}
                  className={cn('rounded-lg px-3 py-1 text-xs font-medium transition-colors', isCompany ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground')}
                >
                  <Building2 className="h-3 w-3 inline mr-1" /> Company
                </button>
              </div>
            )}

            {/* Name */}
            {editing ? (
              <div>
                <Input
                  value={form.name || ''}
                  onChange={e => { setField('name', e.target.value); setErrors(er => { const n = { ...er }; delete n.name; return n }) }}
                  placeholder={isCompany ? 'Company Name' : 'Contact Name'}
                  className={`text-xl font-bold border-0 border-b rounded-none px-0 h-auto py-1 focus-visible:ring-0 ${errors.name ? 'border-red-500 focus-visible:border-red-500' : 'border-border/40 focus-visible:border-primary'}`}
                />
                {errors.name && <p className="text-xs text-destructive mt-1">{errors.name}</p>}
              </div>
            ) : (
              <h2 className="text-2xl font-bold tracking-tight">{displayName}</h2>
            )}

            {/* Company / Job position */}
            <div className="flex items-center gap-3 flex-wrap">
              {!isCompany && <M2OField field="parent_id" model="res.partner" label="Company" />}
              {!isCompany && <TextField field="function" label="Job Position" />}
            </div>
          </div>
        </div>
      }
      leftFields={
        <>
          {/* Address block */}
          <TextField field="street" label="Street" />
          <TextField field="street2" label="Street 2" />
          <div className="grid grid-cols-2 gap-2">
            <TextField field="city" label="City" />
            <M2OField field="state_id" model="res.country.state" label="State" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <TextField field="zip" label="Zip" />
            <M2OField field="country_id" model="res.country" label="Country" />
          </div>
        </>
      }
      rightFields={
        <>
          <TextField field="vat" label="Tax ID" />
          <TextField field="phone" label="Phone" type="tel" />
          <TextField field="mobile" label="Mobile" type="tel" />
          <TextField field="email" label="Email" type="email" />
          <TextField field="website" label="Website" type="url" />
          {/* Tags */}
          {!editing ? (
            <ReadonlyField
              label="Tags"
              value={
                Array.isArray(form.category_id) && form.category_id.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {form.category_id.map((t: any, i: number) => (
                      <Badge key={i} variant="secondary" className="rounded-full text-xs">{Array.isArray(t) ? t[1] : t?.display_name || t}</Badge>
                    ))}
                  </div>
                ) : undefined
              }
            />
          ) : (
            <FormField label="Tags">
              <div className="flex flex-wrap gap-1">
                {(form.category_id || []).map((t: any, i: number) => (
                  <Badge key={i} variant="secondary" className="rounded-full text-xs gap-1">
                    {Array.isArray(t) ? t[1] : t?.display_name || t}
                    <button onClick={() => {
                      const newTags = [...(form.category_id || [])]
                      newTags.splice(i, 1)
                      setField('category_id', newTags)
                    }} className="text-muted-foreground hover:text-foreground">&times;</button>
                  </Badge>
                ))}
              </div>
            </FormField>
          )}
        </>
      }
      tabs={tabs}
      chatter={recordId ? <Chatter model="res.partner" resId={recordId} /> : undefined}
    />
  )
}
