// Shared reusable components for all module pages

export { default as DataTable } from './DataTable'
export type { Column, DataTableProps } from './DataTable'

export { default as PageHeader } from './PageHeader'
export type { PageHeaderProps } from './PageHeader'

export { default as StatusBar, stepsFromSelection } from './StatusBar'
export type { StatusStep, StatusBarProps } from './StatusBar'

export { default as SearchBar } from './SearchBar'
export type { FilterOption, SearchBarProps } from './SearchBar'

export { default as StatCards } from './StatCards'
export type { StatCardData, StatCardsProps } from './StatCards'

export { default as RecordForm, FormField, FormSection, ReadonlyField } from './RecordForm'
export type { SmartButton, FormTab, RecordFormProps } from './RecordForm'

export { default as ConfirmDialog } from './ConfirmDialog'
export type { ConfirmDialogProps } from './ConfirmDialog'

export { default as EmptyState } from './EmptyState'
export type { EmptyStateProps } from './EmptyState'

export { default as LoadingState } from './LoadingState'
export type { LoadingStateProps } from './LoadingState'

export { default as ErrorState } from './ErrorState'
export type { ErrorStateProps } from './ErrorState'

export { default as M2OInput } from './M2OInput'
export type { M2OInputProps } from './M2OInput'

export { default as FieldHelp } from './FieldHelp'

export { default as QuickCreateDialog, QUICK_CREATE_PRESETS } from './QuickCreateDialog'
export type { QuickCreateConfig, QuickField } from './QuickCreateDialog'

export { default as OrderLinesEditor } from './OrderLinesEditor'
export type { OrderLinesEditorProps } from './OrderLinesEditor'

export { default as BulkActionBar } from './BulkActionBar'
export type { BulkAction, BulkActionBarProps } from './BulkActionBar'

export { toast, ToastContainer } from './Toast'

export { default as KanbanBoard } from './KanbanBoard'
export type { KanbanColumn, KanbanCardData } from './KanbanBoard'

export { default as ViewToggle } from './ViewToggle'
export type { ViewMode } from './ViewToggle'

export { default as EmailComposer } from './EmailComposer'
export type { EmailComposerProps } from './EmailComposer'

export { default as AttachmentSection } from './AttachmentSection'
export type { AttachmentSectionProps } from './AttachmentSection'

export { default as RecurrenceField } from './RecurrenceField'
export type { RecurrenceFieldProps, RecurrenceValue } from './RecurrenceField'

export { default as PrintableReport } from './PrintableReport'
export type { PrintableReportProps } from './PrintableReport'

export { default as GanttChart } from './GanttChart'
export type { GanttItem } from './GanttChart'

export { default as PosOfflineBadge } from './PosOfflineBadge'

export { default as ErrorBoundary } from './ErrorBoundary'
