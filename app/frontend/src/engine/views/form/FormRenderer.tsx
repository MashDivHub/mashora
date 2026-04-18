import { Fragment } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger, Button, Separator, Badge, cn } from '@mashora/design-system'
import { getFieldComponent } from '../../fields/FieldRegistry'
import FieldWrapper from '../../fields/FieldWrapper'
import { evaluateExpression } from '../../utils/expression'
import { formatFloat, formatInteger } from '../../utils/format'
import {
  ChevronRight, Truck, FileText, ShoppingCart, Users, DollarSign, Package,
  Clock, BarChart3, Star, Mail, Phone, MapPin, Calendar, Settings, Eye,
  Wrench, FileCheck, Send, Printer, CheckCircle, XCircle, Lock, Unlock,
  Copy, RotateCcw, CreditCard, Ban, Play, Pause, RefreshCw, Download,
  Upload, Trash2, Plus, Edit3, Archive, ExternalLink,
  type LucideIcon,
} from 'lucide-react'

/**
 * Arch nodes are parsed XML — the shape is dynamic (attrs, children, tag).
 * We narrow at use sites rather than enumerating every possible field.
 */
interface ArchNode {
  tag?: string
  name?: string
  string?: string
  widget?: string
  text?: string
  class?: string
  readonly?: string | boolean
  required?: string | boolean
  invisible?: string | boolean
  nolabel?: string
  col?: string
  for_?: string
  href?: string
  src?: string
  type?: string
  confirm?: string
  children?: ArchNode[]
  attrs?: Record<string, string | undefined>
  [key: string]: unknown
}

type FieldMeta = {
  type: string
  string: string
  help?: string
  required?: boolean
  readonly?: boolean
  selection?: [string, string][]
  relation?: string
  digits?: [number, number]
  currency_field?: string
  [key: string]: unknown
}

interface FormRendererProps {
  arch: ArchNode | null | undefined
  fields: Record<string, FieldMeta>
  record: Record<string, unknown>
  readonly: boolean
  onFieldChange: (name: string, value: unknown) => void
  onButtonClick: (method: string, confirm?: string) => void
}

/* ── Format monetary with Mashora currency_id ([id, "USD"]) ── */
function fmtMoney(value: unknown, currencyId?: unknown): string {
  if (value === null || value === false || value === undefined) return ''
  const sym = Array.isArray(currencyId) ? currencyId[1] || '$' : (typeof currencyId === 'string' ? currencyId : '$')
  return `${sym}\u00a0${Number(value).toFixed(2)}`
}

/* ── Stat-button icon heuristic ── */
const STAT_ICONS: Record<string, LucideIcon> = {
  delivery: Truck, picking: Truck, shipment: Truck, shipping: Truck,
  invoice: FileText, bill: FileText, payment: DollarSign, credit_note: FileText,
  purchase: ShoppingCart, vendor: ShoppingCart,
  sale: BarChart3, order: FileText, quotation: FileText,
  customer: Users, partner: Users, contact: Users,
  product: Package, stock: Package, inventory: Package, warehouse: Package,
  time: Clock, timesheet: Clock, hour: Clock,
  task: FileCheck, project: Settings, activity: Calendar,
  lead: Star, opportunity: Star,
  email: Mail, phone: Phone, address: MapPin,
  view: Eye, report: FileText, repair: Wrench,
}

function guessStatIcon(name: string, label: string): LucideIcon {
  const text = `${name} ${label}`.toLowerCase()
  for (const [keyword, icon] of Object.entries(STAT_ICONS)) {
    if (text.includes(keyword)) return icon
  }
  return FileText
}

/* ── Workflow button icon heuristic ── */
const BTN_ICONS: Record<string, LucideIcon> = {
  send: Send, mail: Send, email: Send, quotation_send: Send,
  print: Printer, report: Printer,
  confirm: CheckCircle, validate: CheckCircle, approve: CheckCircle, action_confirm: CheckCircle,
  cancel: XCircle, action_cancel: XCircle, refuse: XCircle, reject: XCircle,
  draft: RotateCcw, reset: RotateCcw, set_to_draft: RotateCcw,
  preview: Eye, view: Eye,
  lock: Lock, unlock: Unlock, action_lock: Lock, action_unlock: Unlock,
  pay: CreditCard, payment: CreditCard, register_payment: CreditCard,
  invoice: FileText, create_invoice: FileText,
  duplicate: Copy, copy: Copy,
  delete: Trash2, unlink: Trash2, archive: Archive,
  start: Play, stop: Pause, done: CheckCircle,
  refresh: RefreshCw, update: RefreshCw,
  download: Download, export: Download,
  upload: Upload, import: Upload,
  create: Plus, new: Plus, add: Plus,
  edit: Edit3, write: Edit3,
  open: ExternalLink, link: ExternalLink,
  capture: CreditCard, void: Ban,
}

function guessButtonIcon(name: string, label: string): LucideIcon | null {
  const text = `${name} ${label}`.toLowerCase()
  for (const [keyword, icon] of Object.entries(BTN_ICONS)) {
    if (text.includes(keyword)) return icon
  }
  return null
}

export default function FormRenderer({ arch, fields, record, readonly, onFieldChange, onButtonClick }: FormRendererProps) {
  if (!arch) return null

  function isInvisible(el: ArchNode): boolean {
    if (!el.invisible) return false
    const inv = String(el.invisible)
    if (inv === '1' || inv === 'True' || inv === 'true') return true
    try {
      return evaluateExpression(inv, record)
    } catch {
      return false
    }
  }

  function renderField(el: ArchNode, key: string | number, parentTag?: string, parentClass?: string): React.ReactNode {
    const fieldName = el.name
    if (!fieldName) return null
    const fieldMeta = fields[fieldName]
    if (!fieldMeta) return null

    // Check invisible on the field element
    if (isInvisible(el)) return null

    const isReadonly = Boolean(readonly || el.readonly === '1' || el.readonly === 'True' ||
      (el.readonly && typeof el.readonly === 'string' && evaluateExpression(String(el.readonly), record)))
    const isRequired = Boolean(el.required === '1' || el.required === 'True' || fieldMeta.required ||
      (el.required && typeof el.required === 'string' && evaluateExpression(el.required, record)))

    const widget = el.widget

    // ── statinfo widget (inside oe_stat_button) ──
    if (widget === 'statinfo') {
      const val = record[fieldName] as number | null | false
      const label = el.string || fieldMeta.string || fieldName
      const formatted = fieldMeta.type === 'float' || fieldMeta.type === 'monetary'
        ? formatFloat(val) : formatInteger(val)
      return (
        <div key={key} className="text-center">
          <div className="text-lg font-bold leading-tight">{formatted || '0'}</div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</div>
        </div>
      )
    }

    // ── account-tax-totals-field widget ──
    if (widget === 'account-tax-totals-field') {
      const totalsRaw = record[fieldName]
      if (!totalsRaw || typeof totalsRaw !== 'object') return null
      type TaxGroup = { tax_group_name?: string; tax_group_amount?: unknown }
      type TaxTotals = {
        subtotals?: Array<{ name?: string; amount?: unknown }>
        groups_by_subtotal?: Record<string, TaxGroup[]>
        currency_id?: unknown
        amount_total?: unknown
        amount_untaxed?: unknown
        amount_tax?: unknown
      }
      const totals = totalsRaw as TaxTotals
      return (
        <div key={key} className="space-y-2 text-sm">
          {totals.subtotals?.map((sub, i: number) => (
            <div key={i}>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{sub.name || 'Untaxed Amount'}</span>
                <span className="font-medium">{fmtMoney(sub.amount, totals.currency_id)}</span>
              </div>
            </div>
          ))}
          {totals.groups_by_subtotal && Object.entries(totals.groups_by_subtotal).map(([, taxes]: [string, unknown], i: number) => (
            <Fragment key={`tax-${i}`}>
              {(Array.isArray(taxes) ? taxes as TaxGroup[] : []).map((tax, j: number) => (
                <div key={j} className="flex justify-between text-muted-foreground">
                  <span>{tax.tax_group_name}</span>
                  <span>{fmtMoney(tax.tax_group_amount, totals.currency_id)}</span>
                </div>
              ))}
            </Fragment>
          ))}
          {totals.amount_total !== undefined && (
            <div className="flex justify-between border-t border-border/60 pt-2 font-semibold text-base">
              <span>Total</span>
              <span>{fmtMoney(totals.amount_total, totals.currency_id)}</span>
            </div>
          )}
          {totals.amount_untaxed !== undefined && !totals.subtotals?.length && (
            <>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Untaxed Amount</span>
                <span>{fmtMoney(totals.amount_untaxed, totals.currency_id)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Taxes</span>
                <span>{fmtMoney(totals.amount_tax, totals.currency_id)}</span>
              </div>
              <div className="flex justify-between border-t border-border/60 pt-2 font-semibold text-base">
                <span>Total</span>
                <span>{fmtMoney(totals.amount_total, totals.currency_id)}</span>
              </div>
            </>
          )}
        </div>
      )
    }

    // ── statusbar in header ──
    const isStatusbar = widget === 'statusbar'
    const wrapperClass = cn(
      el.nolabel === '1' && 'col-span-full',
      isStatusbar && parentTag === 'header' && 'ml-auto',
    )

    const FieldComponent = getFieldComponent(fieldMeta.type, widget)

    return (
      <FieldWrapper
        key={key}
        name={fieldName}
        label={isStatusbar ? undefined : (el.string || fieldMeta.string || fieldName)}
        help={fieldMeta.help}
        required={isRequired}
        readonly={isReadonly}
        invisible={false}
        className={wrapperClass}
      >
        <FieldComponent
          name={fieldName}
          value={record[fieldName]}
          fieldMeta={fieldMeta}
          record={record}
          onChange={v => onFieldChange(fieldName, v)}
          readonly={isReadonly}
          required={isRequired}
          widget={widget}
        />
      </FieldWrapper>
    )
  }

  function renderElementSafe(el: ArchNode | string | null | undefined, key: string | number, parentTag?: string, parentClass?: string): React.ReactNode {
    try {
      return renderElement(el, key, parentTag, parentClass)
    } catch {
      /* ignore: individual element render failures should not break the whole form;
         the bad element is skipped and the rest of the arch keeps rendering */
      return null
    }
  }

  function renderElement(el: ArchNode | string | null | undefined, key: string | number, parentTag?: string, parentClass?: string): React.ReactNode {
    if (!el || typeof el === 'string') return el ? <span key={key}>{el}</span> : null
    if (isInvisible(el)) return null

    const elClass = el.attrs?.class || el.class || ''
    const children = el.children?.map((c, i: number) => renderElementSafe(c, i, el.tag, elClass))

    switch (el.tag) {
      case 'form':
        return <div key={key}>{children}</div>

      case 'header':
        return (
          <div key={key} className="flex items-center gap-2 flex-wrap px-6 py-3 bg-muted/10 border-b border-border/40">
            {children}
          </div>
        )

      case 'sheet':
        return <div key={key} className="px-6 py-4 space-y-4">{children}</div>

      // ── Div: Mashora uses CSS classes to convey layout semantics ──
      case 'div': {
        const name = el.name || el.attrs?.name || ''

        // ── Button Box (smart buttons) ──
        if (elClass.includes('oe_button_box')) {
          const visibleButtons = el.children?.filter(c => !isInvisible(c)) || []
          if (visibleButtons.length === 0) return null
          return (
            <div key={key} className="flex flex-wrap gap-2 mb-4">
              {visibleButtons.map((c, i: number) => renderElement(c, i, 'button_box', elClass))}
            </div>
          )
        }

        // ── Title ──
        if (elClass.includes('oe_title')) {
          return (
            <div key={key} className="mb-4">
              {children}
            </div>
          )
        }

        // ── Alert banners ──
        if (elClass.includes('alert')) {
          const isWarning = elClass.includes('alert-warning')
          const isInfo = elClass.includes('alert-info')
          const isDanger = elClass.includes('alert-danger')
          return (
            <div key={key} className={cn(
              'rounded-xl px-4 py-3 text-sm mb-3 flex items-center gap-2',
              isWarning && 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
              isInfo && 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
              isDanger && 'bg-red-500/10 text-red-400 border border-red-500/20',
              !isWarning && !isInfo && !isDanger && 'bg-muted/30 text-muted-foreground border border-border/40',
            )}>
              {children}
            </div>
          )
        }

        // ── Subtotal footer ──
        if (elClass.includes('oe_subtotal_footer')) {
          return (
            <div key={key} className="ml-auto max-w-xs w-full space-y-1">
              {children}
            </div>
          )
        }

        // ── o_td_label (label wrapper) ──
        if (elClass.includes('o_td_label')) {
          return <Fragment key={key}>{children}</Fragment>
        }

        // ── o_row (inline row) ──
        if (elClass.includes('o_row')) {
          return <div key={key} className="flex items-center gap-2">{children}</div>
        }

        // ── Badge / pill ──
        if (elClass.includes('badge') || elClass.includes('rounded-pill')) {
          return (
            <Badge key={key} variant="secondary" className="text-xs">
              {children}
            </Badge>
          )
        }

        // ── text-muted helper text ──
        if (elClass.includes('text-muted')) {
          return <div key={key} className="text-xs text-muted-foreground flex items-center gap-1">{children}</div>
        }

        // ── o_stat_info (stat info inside stat button, not using widget="statinfo") ──
        if (elClass.includes('o_stat_info') || elClass.includes('o_form_field')) {
          return <div key={key} className="text-center">{children}</div>
        }

        // ── d-flex layout ──
        if (elClass.includes('d-flex')) {
          return (
            <div key={key} className={cn(
              'flex',
              elClass.includes('flex-column') && 'flex-col',
              elClass.includes('flex-grow-1') && 'flex-1',
              elClass.includes('gap-1') && 'gap-1',
              elClass.includes('gap-2') && 'gap-2',
              elClass.includes('gap-3') && 'gap-3',
              elClass.includes('align-items-center') && 'items-center',
              !elClass.includes('flex-column') && !elClass.includes('gap') && 'gap-3',
            )}>
              {children}
            </div>
          )
        }

        // ── o_address_format (address fields block) ──
        if (elClass.includes('o_address_format')) {
          return <div key={key} className="space-y-2">{children}</div>
        }

        // ── Generic div ──
        return <div key={key} className={cn(
          elClass.includes('float-end') && 'ml-auto',
          elClass.includes('mb8') || elClass.includes('mb-3') ? 'mb-3' : '',
          elClass.includes('flex-grow-1') && 'flex-1',
        )}>{children}</div>
      }

      // ── Group: grid layout ──
      case 'group': {
        const cols = parseInt(el.col || '2')
        const groupString = el.string || el.attrs?.string

        // Subtotal footer group
        if (elClass.includes('oe_subtotal_footer')) {
          return (
            <div key={key} className="ml-auto max-w-sm w-full">
              {children}
            </div>
          )
        }

        // Check if this group's children are all groups (column container pattern)
        const childGroups = el.children?.filter(c => c.tag === 'group' && !isInvisible(c)) || []
        const isColumnContainer = childGroups.length > 0 &&
          childGroups.length === el.children?.filter(c => !isInvisible(c) && c.tag !== 'newline').length

        if (isColumnContainer) {
          // Parent group acting as column container
          return (
            <div key={key} className={cn(
              'grid gap-x-8 gap-y-2',
              childGroups.length === 2 && 'md:grid-cols-2',
              childGroups.length === 3 && 'md:grid-cols-3',
              childGroups.length >= 4 && 'md:grid-cols-4',
            )}>
              {groupString && (
                <h3 className="col-span-full text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground mt-4 first:mt-0 mb-0.5 border-b border-border/30 pb-1.5">
                  {groupString}
                </h3>
              )}
              {children}
            </div>
          )
        }

        // Leaf group (contains fields) — single column of fields
        return (
          <div key={key} className="space-y-2">
            {groupString && (
              <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground mt-4 first:mt-0 mb-0.5 border-b border-border/30 pb-1.5">
                {groupString}
              </h3>
            )}
            {children}
          </div>
        )
      }

      // ── Notebook (tabs) ──
      case 'notebook': {
        const pages = el.children?.filter(c => c.tag === 'page' && !isInvisible(c)) || []
        if (pages.length === 0) return null
        return (
          <Tabs key={key} defaultValue={pages[0]?.name || pages[0]?.attrs?.name || '0'} className="mt-4">
            <TabsList className="bg-muted/40 rounded-xl p-1">
              {pages.map((p, i: number) => (
                <TabsTrigger
                  key={i}
                  value={p.name || p.attrs?.name || String(i)}
                  className="rounded-lg text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm"
                >
                  {p.string || p.attrs?.string || `Tab ${i + 1}`}
                </TabsTrigger>
              ))}
            </TabsList>
            {pages.map((p, i: number) => (
              <TabsContent key={i} value={p.name || p.attrs?.name || String(i)} className="mt-4">
                {p.children?.map((c, j: number) => renderElement(c, j, 'page'))}
              </TabsContent>
            ))}
          </Tabs>
        )
      }

      case 'page':
        return <Fragment key={key}>{children}</Fragment>

      // ── Field rendering ──
      case 'field':
        return renderField(el, key, parentTag, parentClass)

      // ── Button ──
      case 'button': {
        if (isInvisible(el)) return null
        const btnClass = elClass
        const label = el.string || el.attrs?.string
        const btnName = el.name || el.attrs?.name || ''

        // ── Stat button (smart button) ──
        if (btnClass.includes('oe_stat_button')) {
          // Find statinfo: either field with widget="statinfo" or div.o_stat_info
          const statField = el.children?.find(c =>
            c.tag === 'field' && (c.widget === 'statinfo' || c.attrs?.widget === 'statinfo')
          )
          // Also check for div.o_stat_info pattern (contains field + span)
          const statDiv = !statField ? el.children?.find(c =>
            c.tag === 'div' && ((c.attrs?.class || c.class || '').includes('o_stat_info') || (c.attrs?.class || c.class || '').includes('o_form_field'))
          ) : null
          // Extract field name and label from either pattern
          let statFieldName: string | undefined
          let statLabel: string | undefined
          if (statField) {
            statFieldName = statField.name || statField.attrs?.name
            statLabel = statField.string || statField.attrs?.string
          } else if (statDiv) {
            // Inside div.o_stat_info: look for field (value) and span (label)
            const innerField = statDiv.children?.find(c => c.tag === 'field')
            const innerSpan = statDiv.children?.find(c => c.tag === 'span' || c.tag === 'label')
            statFieldName = innerField?.name || innerField?.attrs?.name
            statLabel = (typeof innerSpan?.text === 'string' ? innerSpan.text : undefined) || innerSpan?.string || innerField?.string || innerField?.attrs?.string
          }
          if (!statLabel) {
            statLabel = label || btnName.replace(/^action_view_/, '').replace(/^\d+$/, '').replace(/_/g, ' ')
          }
          const statValueRaw = statFieldName ? record[statFieldName] : 0
          const statValue = typeof statValueRaw === 'number' || typeof statValueRaw === 'string'
            ? statValueRaw
            : 0
          const Icon = guessStatIcon(btnName, statLabel || '')

          return (
            <button
              key={key}
              onClick={() => {
                if (el.attrs?.type === 'action' && btnName) {
                  onButtonClick(`__action__${btnName}`, el.attrs?.confirm)
                } else {
                  onButtonClick(btnName, el.attrs?.confirm)
                }
              }}
              className="flex items-center gap-3 rounded-xl border border-border/50 bg-card hover:bg-muted/40 px-4 py-2.5 transition-colors text-left min-w-[140px] cursor-pointer"
            >
              <Icon className="h-5 w-5 text-muted-foreground shrink-0" />
              <div>
                <div className="text-base font-semibold leading-tight">{statValue || 0}</div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{statLabel}</div>
              </div>
            </button>
          )
        }

        // ── Regular button ──
        if (!label) return null // Don't render unlabeled buttons
        const isPrimary = btnClass.includes('btn-primary') || btnClass.includes('oe_highlight')
        const isLink = btnClass.includes('btn-link')
        const isSecondary = btnClass.includes('btn-secondary')

        // Handle states attribute
        if (el.attrs?.states && readonly) {
          const allowedStates = el.attrs.states.split(',').map((s: string) => s.trim())
          const currentState = typeof record.state === 'string' ? record.state : ''
          if (!allowedStates.includes(currentState)) return null
        }

        const BtnIcon = guessButtonIcon(btnName, label)

        return (
          <Button
            key={key}
            variant={isPrimary ? 'default' : isLink ? 'link' : isSecondary ? 'secondary' : 'outline'}
            size="sm"
            className="rounded-xl gap-1.5"
            onClick={() => {
              const type = el.attrs?.type || el.type
              if (type === 'action' && btnName) {
                onButtonClick(`__action__${btnName}`, el.attrs?.confirm || el.confirm)
              } else {
                onButtonClick(btnName, el.attrs?.confirm || el.confirm)
              }
            }}
          >
            {BtnIcon && <BtnIcon className="h-3.5 w-3.5" />}
            {label}
          </Button>
        )
      }

      // ── Heading tags ──
      case 'h1':
        return <h1 key={key} className="text-2xl font-bold tracking-tight">{children}</h1>
      case 'h2':
        return <h2 key={key} className="text-xl font-semibold tracking-tight">{children}</h2>
      case 'h3':
        return <h3 key={key} className="text-lg font-medium">{children}</h3>

      case 'separator':
        return <Separator key={key} className="my-4" />

      case 'label': {
        const forField = el.for_ || el.attrs?.for
        const lblString = el.string || el.attrs?.string
        if (lblString) {
          return <label key={key} className="text-sm font-medium text-muted-foreground">{lblString}</label>
        }
        if (forField && fields[forField]) {
          return <label key={key} className="text-sm font-medium text-muted-foreground">{fields[forField].string || forField}</label>
        }
        return null
      }

      case 'widget':
        // Widgets like web_ribbon, notification, etc. - skip gracefully
        return null

      case 'newline':
        return <div key={key} className="col-span-full" />

      // ── Inline elements ──
      case 'span':
        return <span key={key} className={cn(
          elClass.includes('text-muted') && 'text-muted-foreground',
          elClass.includes('text-warning') && 'text-amber-500',
          elClass.includes('fw-bold') && 'font-bold',
          elClass.includes('mx-3') && 'mx-3',
        )}>{el.text}{children}</span>

      case 'a':
        return <a key={key} href={el.attrs?.href || el.href} className="text-primary underline text-sm" target="_blank" rel="noopener noreferrer">{el.text}{children}</a>

      case 'p':
        return <p key={key} className="text-sm">{el.text}{children}</p>

      case 'strong':
      case 'b':
        return <strong key={key}>{el.text}{children}</strong>

      case 'i':
      case 'em':
        // Could be a Font Awesome icon class
        if (elClass.includes('fa ') || elClass.includes('fa-')) {
          return <span key={key} className="inline-block w-4" />
        }
        return <em key={key}>{el.text}{children}</em>

      case 'img':
        return <img key={key} src={el.attrs?.src || el.src} alt={el.attrs?.alt || ''} className="max-h-32 rounded-xl object-contain" />

      case 't':
        return <Fragment key={key}>{children}</Fragment>

      // ── Tree/list inside one2many ──
      case 'list':
      case 'tree':
        return null // Handled by One2ManyField component

      // ── Control elements (Add a product, Add a section, etc.) ──
      case 'control':
      case 'create':
        return null // Handled by One2ManyField

      case 'chatter':
        return null // Chatter integrated separately in FormView

      case 'kanban':
        return null // Kanban arch inside one2many, handled by field

      default:
        if (!el.tag) return null
        // Unknown tags: render children inline
        return <Fragment key={key}>{children}</Fragment>
    }
  }

  return <>{renderElementSafe(arch, 'root')}</>
}
