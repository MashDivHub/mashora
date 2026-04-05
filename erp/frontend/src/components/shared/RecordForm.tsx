import { type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Tabs, TabsContent, TabsList, TabsTrigger, cn } from '@mashora/design-system'
import { ChevronLeft, Save, X, Pencil, Printer } from 'lucide-react'

/* ── Smart Button ── */
export interface SmartButton {
  label: string
  value: string | number
  icon: ReactNode
  onClick?: () => void
}

/* ── Tab Definition ── */
export interface FormTab {
  key: string
  label: string
  content: ReactNode
  hidden?: boolean
}

/* ── Props ── */
export interface RecordFormProps {
  /** Page title (e.g., "SO001" or "New") */
  title?: string
  /** Status bar component */
  statusBar?: ReactNode
  /** Workflow action buttons (Send, Confirm, etc.) */
  headerActions?: ReactNode
  /** Smart buttons row */
  smartButtons?: SmartButton[]
  /** Top section before tabs (image + key fields) */
  topContent?: ReactNode
  /** Left column fields */
  leftFields?: ReactNode
  /** Right column fields */
  rightFields?: ReactNode
  /** Tabs (Order Lines, Other Info, etc.) */
  tabs?: FormTab[]
  /** Content below tabs (totals, notes) */
  bottomContent?: ReactNode
  /** Chatter component */
  chatter?: ReactNode
  /** Edit mode state */
  editing: boolean
  onEdit?: () => void
  onSave?: () => void
  onDiscard?: () => void
  /** Print menu */
  onPrint?: () => void
  /** Custom back handler */
  backTo?: string
  /** Loading state */
  loading?: boolean
  className?: string
  children?: ReactNode
}

export default function RecordForm({
  title,
  statusBar,
  headerActions,
  smartButtons,
  topContent,
  leftFields,
  rightFields,
  tabs,
  bottomContent,
  chatter,
  editing,
  onEdit,
  onSave,
  onDiscard,
  onPrint,
  backTo,
  loading,
  className,
  children,
}: RecordFormProps) {
  const navigate = useNavigate()

  const handleBack = () => {
    if (backTo) navigate(backTo)
    else navigate(-1)
  }

  const visibleTabs = tabs?.filter(t => !t.hidden) || []

  return (
    <div className={cn('space-y-0', className)}>
      {/* Sticky toolbar */}
      <div className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-border/40 bg-background/95 backdrop-blur-sm px-6 py-2">
        <button onClick={handleBack} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="h-4 w-4" /> Back
        </button>
        <div className="flex items-center gap-2">
          {onPrint && !editing && (
            <Button variant="ghost" size="sm" className="rounded-xl gap-1.5 text-muted-foreground" onClick={onPrint}>
              <Printer className="h-3.5 w-3.5" /> Print
            </Button>
          )}
          {editing ? (
            <>
              <Button variant="ghost" size="sm" className="rounded-xl gap-1.5 text-muted-foreground" onClick={onDiscard}>
                <X className="h-3.5 w-3.5" /> Discard
              </Button>
              <Button size="sm" className="rounded-xl gap-1.5" onClick={onSave}>
                <Save className="h-3.5 w-3.5" /> Save
              </Button>
            </>
          ) : onEdit ? (
            <Button variant="outline" size="sm" className="rounded-xl gap-1.5" onClick={onEdit}>
              <Pencil className="h-3.5 w-3.5" /> Edit
            </Button>
          ) : null}
        </div>
      </div>

      {/* Workflow header: buttons + status bar */}
      {(headerActions || statusBar) && (
        <div className="flex items-center gap-2 flex-wrap px-6 py-3 bg-muted/5 border-b border-border/30">
          {headerActions}
          {statusBar && <div className="ml-auto">{statusBar}</div>}
        </div>
      )}

      {/* Form body */}
      <div className="px-6 py-4 space-y-4">
        {/* Smart buttons */}
        {smartButtons && smartButtons.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {smartButtons.map((btn, i) => (
              <button
                key={i}
                onClick={btn.onClick}
                className="flex items-center gap-3 rounded-xl border border-border/50 bg-card hover:bg-muted/40 px-4 py-2.5 transition-colors text-left min-w-[130px] cursor-pointer"
              >
                <div className="text-muted-foreground shrink-0">{btn.icon}</div>
                <div>
                  <div className="text-base font-semibold leading-tight">{btn.value}</div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{btn.label}</div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Top content (image + key fields side by side) */}
        {topContent}

        {/* Two-column field grid */}
        {(leftFields || rightFields) && (
          <div className="grid md:grid-cols-2 gap-x-8 gap-y-2">
            <div className="space-y-2">{leftFields}</div>
            <div className="space-y-2">{rightFields}</div>
          </div>
        )}

        {/* Free-form children */}
        {children}

        {/* Tabs */}
        {visibleTabs.length > 0 && (
          <Tabs defaultValue={visibleTabs[0].key} className="mt-2">
            <TabsList className="bg-muted/40 rounded-xl p-1">
              {visibleTabs.map(tab => (
                <TabsTrigger
                  key={tab.key}
                  value={tab.key}
                  className="rounded-lg text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm"
                >
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
            {visibleTabs.map(tab => (
              <TabsContent key={tab.key} value={tab.key} className="mt-3">
                {tab.content}
              </TabsContent>
            ))}
          </Tabs>
        )}

        {/* Bottom content (totals, notes) */}
        {bottomContent}
      </div>

      {/* Chatter */}
      {chatter && (
        <div className="border-t border-border/40 px-6 py-4">
          {chatter}
        </div>
      )}
    </div>
  )
}

/* ── Form Field Grid helpers ── */

export interface FormFieldProps {
  label: string
  required?: boolean
  help?: string
  className?: string
  children: ReactNode
}

export function FormField({ label, required, help, className, children }: FormFieldProps) {
  return (
    <div className={cn('min-w-0', className)}>
      <div className="flex items-center gap-1 mb-0.5">
        <label className="text-[13px] font-medium text-foreground/80">
          {label}
          {required && <span className="text-destructive ml-0.5">*</span>}
        </label>
        {help && <span className="text-[10px] text-muted-foreground/60">(?)</span>}
      </div>
      {children}
    </div>
  )
}

export function FormSection({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn('space-y-2', className)}>
      <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground border-b border-border/30 pb-1.5">
        {title}
      </h3>
      {children}
    </div>
  )
}

export function ReadonlyField({ label, value, className }: { label: string; value: ReactNode; className?: string }) {
  return (
    <div className={cn('min-w-0', className)}>
      <p className="text-[13px] font-medium text-muted-foreground mb-0.5">{label}</p>
      <p className="text-sm">{value || <span className="text-muted-foreground/40">&mdash;</span>}</p>
    </div>
  )
}
