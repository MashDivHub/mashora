import { lazy, type ComponentType } from 'react'

type ClientActionComponent = ComponentType<any>

// Registry of hand-coded pages that should be used instead of dynamic views
const registry: Record<string, () => Promise<{ default: ClientActionComponent }>> = {
  // Dashboards (kept as client actions)
  'dashboard:main': () => import('@/pages/Dashboard'),
  'dashboard:sales': () => import('@/pages/sales/SalesDashboard'),
  'dashboard:accounting': () => import('@/pages/accounting/AccountingDashboard'),
  'dashboard:crm': () => import('@/pages/crm/CrmDashboard'),
  'dashboard:purchase': () => import('@/pages/purchase/PurchaseDashboard'),
  'dashboard:inventory': () => import('@/pages/inventory/InventoryDashboard'),
  'dashboard:hr': () => import('@/pages/hr/HrDashboard'),
  'dashboard:projects': () => import('@/pages/project/ProjectDashboard'),
  'dashboard:website': () => import('@/pages/website/WebsiteDashboard'),
}

export function getClientAction(key: string): (() => Promise<{ default: ClientActionComponent }>) | null {
  return registry[key] || null
}

export function registerClientAction(key: string, loader: () => Promise<{ default: ClientActionComponent }>): void {
  registry[key] = loader
}

export function hasClientAction(key: string): boolean {
  return key in registry
}
