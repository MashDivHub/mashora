import { type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Tabs, TabsContent, TabsList, TabsTrigger, Separator, cn } from '@mashora/design-system'
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
  title?: string
  statusBar?: ReactNode
  headerActions?: ReactNode
  smartButtons?: SmartButton[]
  topContent?: ReactNode
  leftFields?: ReactNode
  rightFields?: ReactNode
  tabs?: FormTab[]
  bottomContent?: ReactNode
  chatter?: ReactNode
  editing: boolean
  onEdit?: () => void
  onSave?: () => void
  onDiscard?: () => void
  onPrint?: () => void
  backTo?: string
  loading?: boolean
  className?: string
  children?: ReactNode
}

export default function RecordForm({
  title, statusBar, headerActions, smartButtons, topContent,
  leftFields, rightFields, tabs, bottomContent, chatter,
  editing, onEdit, onSave, onDiscard, onPrint, backTo,
  loading, className, children,
}: RecordFormProps) {
  const navigate = useNavigate()

  const handleBack = () => {
    if (backTo) navigate(backTo)
    else navigate(-1)
  }

  const visibleTabs = tabs?.filter(t => !t.hidden) || []

  return (
    <div className={cn('-mx-4 sm:-mx-6 lg:-mx-8 -mt-6 lg:-mt-10', className)}>
      {/* ── Sticky Toolbar ── */}
      <div className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-border/40 bg-background/95 backdrop-blur-md px-6 py-2.5 shadow-sm shadow-background/20">
        <button onClick={handleBack} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors group">
          <ChevronLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" /> Back
        </button>
        <div className="flex items-center gap-2">
          {onPrint && !editing && (
            <Button variant="ghost" size="sm" className="rounded-xl gap-1.5 text-muted-foreground" onClick={onPrint}>
              <Printer className="h-3.5 w-3.5" /> Print
            </Button>
          )}
          {editing ? (
            <>
              <Button variant="ghost" size="sm" className="rounded-xl gap-1.5 text-muted-foreground hover:text-destructive" onClick={onDiscard}>
                <X className="h-3.5 w-3.5" /> Discard
              </Button>
              <Button size="sm" className="rounded-xl gap-1.5 shadow-sm" onClick={onSave}>
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

      {/* ── Workflow Header ── */}
      {(headerActions || statusBar) && (
        <div className="flex items-center gap-2 flex-wrap px-6 py-2.5 bg-gradient-to-b from-muted/10 to-transparent border-b border-border/20">
          <div className="flex items-center gap-2 flex-wrap">{headerActions}</div>
          {statusBar && <div className="ml-auto">{statusBar}</div>}
        </div>
      )}

      {/* ── Form Body ── */}
      <div className="px-6 lg:px-8 py-5 space-y-5 max-w-6xl">
        {/* Smart Buttons */}
        {smartButtons && smartButtons.length > 0 && (
          <div className="flex flex-wrap gap-2.5">
            {smartButtons.map((btn, i) => (
              <button
                key={i}
                onClick={btn.onClick}
                className={cn(
                  'flex items-center gap-3 rounded-2xl border border-border/40 bg-gradient-to-b from-card to-card/80 px-5 py-3 transition-all text-left min-w-[140px]',
                  btn.onClick && 'cursor-pointer hover:shadow-md hover:-translate-y-0.5 hover:border-primary/30',
                )}
              >
                <div className="rounded-xl bg-primary/8 p-2 text-muted-foreground">{btn.icon}</div>
                <div>
                  <div className="text-lg font-bold leading-tight tabular-nums">{btn.value}</div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-[0.15em] font-medium">{btn.label}</div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Top Content */}
        {topContent}

        {/* Two-Column Field Grid */}
        {(leftFields || rightFields) && (
          <div className="rounded-2xl border border-border/30 bg-card/50 p-5 lg:p-6">
            <div className="grid md:grid-cols-2 gap-x-10 gap-y-3">
              <div className="space-y-3">{leftFields}</div>
              <div className="space-y-3">{rightFields}</div>
            </div>
          </div>
        )}

        {/* Free-form children */}
        {children}

        {/* Tabs */}
        {visibleTabs.length > 0 && (
          <Tabs defaultValue={visibleTabs[0].key}>
            <TabsList className="bg-muted/30 border border-border/30 rounded-xl p-1 h-auto">
              {visibleTabs.map(tab => (
                <TabsTrigger
                  key={tab.key}
                  value={tab.key}
                  className="rounded-lg text-sm py-1.5 px-4 data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:border-border/50 transition-all"
                >
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
            {visibleTabs.map(tab => (
              <TabsContent key={tab.key} value={tab.key} className="mt-4 rounded-2xl border border-border/30 bg-card/50 p-5 lg:p-6">
                {tab.content}
              </TabsContent>
            ))}
          </Tabs>
        )}

        {/* Bottom content */}
        {bottomContent}
      </div>

      {/* ── Chatter ── */}
      {chatter && (
        <div className="border-t border-border/30 px-6 lg:px-8 py-5">
          {chatter}
        </div>
      )}
    </div>
  )
}

/* ── Form Field Helpers ── */

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
      <div className="flex items-center gap-1.5 mb-1">
        <label className="text-[13px] font-medium text-foreground/70">
          {label}
          {required && <span className="text-destructive ml-0.5">*</span>}
        </label>
        {help && <span className="text-[10px] text-muted-foreground/50 hover:text-muted-foreground transition-colors cursor-help">(?)</span>}
      </div>
      {children}
    </div>
  )
}

export function FormSection({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn('space-y-3', className)}>
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/70 pb-1.5 border-b border-border/20">
        {title}
      </h3>
      {children}
    </div>
  )
}

export function ReadonlyField({ label, value, className }: { label: string; value: ReactNode; className?: string }) {
  return (
    <div className={cn('min-w-0', className)}>
      {label && <p className="text-[13px] font-medium text-muted-foreground/60 mb-0.5">{label}</p>}
      <div className="text-sm min-h-[24px] flex items-center">{value || <span className="text-muted-foreground/30">&mdash;</span>}</div>
    </div>
  )
}
