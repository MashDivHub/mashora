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
