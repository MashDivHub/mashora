import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { Input, Textarea, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Badge, Button, Skeleton, cn } from '@mashora/design-system'
import { Building2, User, Star, BarChart3, FileText, Calendar, CheckSquare, ShoppingCart, Truck, CreditCard, Users } from 'lucide-react'
import { RecordForm, FormField, FormSection, ReadonlyField, StatusBar, toast, type SmartButton, type FormTab } from '@/components/shared'
import Chatter from '@/components/Chatter'
import { erpClient } from '@/lib/erp-api'
import { extractErrorMessage } from '@/lib/errors'
import { sanitizedHtml } from '@/lib/sanitize'

interface ContactFormState {
  id?: number | null
  name?: string
  display_name?: string
  email?: string
  phone?: string
  mobile?: string
  website?: string
  street?: string
  street2?: string
  city?: string
  zip?: string
  is_company?: boolean
  company_type?: string
  function?: string
  vat?: string
  comment?: string
  barcode?: string
  lang?: string
  image_1920?: string
  image_128?: string
  customer_rank?: number
  supplier_rank?: number
  active?: boolean
  parent_id?: [number, string] | false | number
  state_id?: [number, string] | false | number
  country_id?: [number, string] | false | number
  title?: [number, string] | false | number
  property_payment_term_id?: [number, string] | false | number
  property_supplier_payment_term_id?: [number, string] | false | number
  property_account_position_id?: [number, string] | false | number
  property_product_pricelist?: [number, string] | false | number
  property_purchase_currency_id?: [number, string] | false | number
  opportunity_count?: number
  sale_order_count?: number
  meeting_count?: number
  task_count?: number
  purchase_order_count?: number
  supplier_invoice_count?: number
  credit?: number
  debit?: number
  total_invoiced?: number
  bank_account_count?: number
  category_id?: TagValue[]
  child_ids?: Array<{ id?: number; name?: string; display_name?: string; email?: string; phone?: string; function?: string } | number>
  [key: string]: unknown
}
interface NameSearchResult { id: number; display_name: string }
type TagValue = [number, string] | { id?: number; display_name?: string } | number

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

// ─── Module-scoped helpers ──────────────────────────────────────────────────
// These MUST live outside ContactForm: defining them inside the parent would
// give them a new component identity on every render, re-mounting the <Input>
// elements and stealing focus after each keystroke.

function _m2oDisplay(val: unknown): string {
  return Array.isArray(val) ? String(val[1]) : ''
}

function TextField({
  field, label, required, type = 'text', hint,
  editing, form, setField,
}: {
  field: string; label: string; required?: boolean; type?: string; hint?: string
  editing: boolean
  form: ContactFormState
  setField: (field: string, value: unknown) => void
}) {
  const fv = form[field]
  if (!editing) return <ReadonlyField label={label} value={(typeof fv === 'string' || typeof fv === 'number') ? fv : undefined} />
  return (
    <FormField label={label} required={required}>
      <Input type={type} value={(typeof fv === 'string' || typeof fv === 'number') ? fv : ''} onChange={e => setField(field, e.target.value)} className="rounded-xl h-9" />
      {hint && <p className="text-[11px] text-muted-foreground mt-1">{hint}</p>}
    </FormField>
  )
}

function M2OField({
  field, model, label, required, hint,
  editing, form, setField,
  m2oResults, searchM2o,
}: {
  field: string; model: string; label: string; required?: boolean; hint?: string
  editing: boolean
  form: ContactFormState
  setField: (field: string, value: unknown) => void
  m2oResults: Record<string, NameSearchResult[]>
  searchM2o: (model: string, query: string, field: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const results = m2oResults[field] || []

  if (!editing) return <ReadonlyField label={label} value={_m2oDisplay(form[field])} />
  return (
    <FormField label={label} required={required}>
      <div className="relative">
        <Input
          value={open ? q : _m2oDisplay(form[field])}
          onChange={e => { setQ(e.target.value); searchM2o(model, e.target.value, field) }}
          onFocus={() => { setQ(_m2oDisplay(form[field])); setOpen(true) }}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          placeholder="Search..."
          className="rounded-xl h-9"
          autoComplete="off"
        />
        {open && results.length > 0 && (
          <div className="absolute z-50 mt-1 w-full rounded-xl border border-border/60 bg-popover shadow-lg max-h-48 overflow-y-auto">
            {results.map((r) => (
              <button
                key={r.id}
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-accent transition-colors first:rounded-t-xl last:rounded-b-xl"
                onMouseDown={() => { setField(field, [r.id, r.display_name]); setOpen(false) }}
              >
                {r.display_name}
              </button>
            ))}
          </div>
        )}
      </div>
      {hint && <p className="text-[11px] text-muted-foreground mt-1">{hint}</p>}
    </FormField>
  )
}

export default function ContactForm() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isNew = !id || id === 'new'
  const recordId = isNew ? null : parseInt(id || '0')
  const [editing, setEditing] = useState(isNew)
  const [form, setForm] = useState<ContactFormState>({})
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

  const setField = useCallback((name: string, value: unknown) => {
    setForm(prev => ({ ...prev, [name]: value }))
    setDirty(true)
  }, [])

  // Validation
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validate = useCallback((): boolean => {
    const errs: Record<string, string> = {}
    if (!(typeof form.name === 'string' && form.name.trim())) errs.name = 'Name is required'
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
      const vals: Record<string, unknown> = {}
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
        const ids = (form.category_id || []).map((t) => Array.isArray(t) ? t[0] : typeof t === 'object' ? t.id : t)
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
    onError: (e: unknown) => {
      const msg = extractErrorMessage(e)
      if (msg !== 'Validation failed') {
        toast.error('Save Failed', msg)
      }
    },
  })

  // Many2one search helper
  const [m2oResults, setM2oResults] = useState<Record<string, NameSearchResult[]>>({})
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
  const m2oDisplay = (val: unknown) => Array.isArray(val) ? String(val[1]) : ''

  // Smart buttons
  const smartButtons: SmartButton[] = [
    (form.opportunity_count ?? 0) > 0 && { label: 'Opportunities', value: form.opportunity_count!, icon: <Star className="h-5 w-5" /> },
    (form.sale_order_count ?? 0) > 0 && { label: 'Sales', value: form.sale_order_count!, icon: <BarChart3 className="h-5 w-5" /> },
    (form.total_invoiced ?? 0) > 0 && { label: 'Invoiced', value: `$${(form.total_invoiced || 0).toFixed(0)}`, icon: <FileText className="h-5 w-5" /> },
    (form.meeting_count ?? 0) > 0 && { label: 'Meetings', value: form.meeting_count!, icon: <Calendar className="h-5 w-5" /> },
    (form.task_count ?? 0) > 0 && { label: 'Tasks', value: form.task_count!, icon: <CheckSquare className="h-5 w-5" /> },
    (form.purchase_order_count ?? 0) > 0 && { label: 'Purchases', value: form.purchase_order_count!, icon: <ShoppingCart className="h-5 w-5" /> },
  ].filter(Boolean) as SmartButton[]


  // Tabs
  const tabs: FormTab[] = [
    {
      key: 'contacts',
      label: 'Contacts & Addresses',
      content: (
        <div className="space-y-3">
          {Array.isArray(form.child_ids) && form.child_ids.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {form.child_ids.slice(0, 12).map((child) => {
                const c: { id?: number; name?: string; display_name?: string; email?: string; phone?: string; function?: string } =
                  typeof child === 'object' ? child : { id: child }
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
              <M2OField field="property_payment_term_id" model="account.payment.term" label="Payment Terms" hint="Default payment terms when selling to this customer (e.g. 'Net 30'). Applied automatically to new sales orders/invoices." editing={editing} form={form} setField={setField} m2oResults={m2oResults} searchM2o={searchM2o} />
              <M2OField field="property_product_pricelist" model="product.pricelist" label="Pricelist" hint="Apply special pricing rules for this customer (e.g. 10% off, wholesale pricing). Overrides default product prices on their orders." editing={editing} form={form} setField={setField} m2oResults={m2oResults} searchM2o={searchM2o} />
            </FormSection>
          </div>
          <div className="space-y-2">
            <FormSection title="Purchase">
              <M2OField field="property_supplier_payment_term_id" model="account.payment.term" label="Vendor Payment Terms" hint="Default payment terms when buying from this vendor. Applied to new purchase orders/bills." editing={editing} form={form} setField={setField} m2oResults={m2oResults} searchM2o={searchM2o} />
              <M2OField field="property_purchase_currency_id" model="res.currency" label="Supplier Currency" hint="Currency the vendor invoices in. Leave empty to use your company's default currency." editing={editing} form={form} setField={setField} m2oResults={m2oResults} searchM2o={searchM2o} />
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
              {!isCompany && <M2OField field="parent_id" model="res.partner" label="Company" hint="If this person works for a company, pick it here. Leave empty for a freelancer or individual." editing={editing} form={form} setField={setField} m2oResults={m2oResults} searchM2o={searchM2o} />}
              {!isCompany && <TextField field="function" label="Job Position" hint="e.g. Sales Manager, Purchasing Agent" editing={editing} form={form} setField={setField} />}
            </div>
          </div>
        </div>
      }
      leftFields={
        <>
          {/* Address block */}
          <TextField field="street" label="Street" editing={editing} form={form} setField={setField} />
          <TextField field="street2" label="Street 2" editing={editing} form={form} setField={setField} />
          <div className="grid grid-cols-2 gap-2">
            <TextField field="city" label="City" editing={editing} form={form} setField={setField} />
            <M2OField field="state_id" model="res.country.state" label="State" editing={editing} form={form} setField={setField} m2oResults={m2oResults} searchM2o={searchM2o} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <TextField field="zip" label="Zip" editing={editing} form={form} setField={setField} />
            <M2OField field="country_id" model="res.country" label="Country" editing={editing} form={form} setField={setField} m2oResults={m2oResults} searchM2o={searchM2o} />
          </div>
        </>
      }
      rightFields={
        <>
          <TextField field="vat" label="Tax ID" hint="VAT / tax identification number. Printed on invoices, required in most countries for B2B transactions." editing={editing} form={form} setField={setField} />
          <TextField field="phone" label="Phone" type="tel" editing={editing} form={form} setField={setField} />
          <TextField field="mobile" label="Mobile" type="tel" editing={editing} form={form} setField={setField} />
          <TextField field="email" label="Email" type="email" editing={editing} form={form} setField={setField} />
          <TextField field="website" label="Website" type="url" editing={editing} form={form} setField={setField} />
          {/* Tags */}
          {!editing ? (
            <ReadonlyField
              label="Tags"
              value={
                Array.isArray(form.category_id) && form.category_id.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {form.category_id!.map((t, i) => {
                      const tagKey = Array.isArray(t) ? t[0] : (typeof t === 'object' && t !== null ? (t.id ?? i) : i)
                      const tagLabel = Array.isArray(t) ? t[1] : (typeof t === 'object' && t !== null ? (t.display_name || '') : String(t))
                      return <Badge key={tagKey} variant="secondary" className="rounded-full text-xs">{tagLabel}</Badge>
                    })}
                  </div>
                ) : undefined
              }
            />
          ) : (
            <FormField label="Tags">
              <div className="flex flex-wrap gap-1">
                {(form.category_id || []).map((t, i) => {
                  const tagKey = Array.isArray(t) ? t[0] : (typeof t === 'object' && t !== null ? (t.id ?? i) : i)
                  const tagLabel = Array.isArray(t) ? t[1] : (typeof t === 'object' && t !== null ? (t.display_name || '') : String(t))
                  return (
                    <Badge key={tagKey} variant="secondary" className="rounded-full text-xs gap-1">
                      {tagLabel}
                      <button onClick={() => {
                        const newTags = [...(form.category_id || [])]
                        newTags.splice(i, 1)
                        setField('category_id', newTags)
                      }} className="text-muted-foreground hover:text-foreground">&times;</button>
                    </Badge>
                  )
                })}
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
