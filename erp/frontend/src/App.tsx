import { Suspense, lazy } from 'react'
import { Routes, Route, Navigate, useParams } from 'react-router-dom'
import { Skeleton as BoneSkeleton } from 'boneyard-js/react'
import { computeLayout } from 'boneyard-js/layout'
import Layout from './components/Layout'

// Engine router
const ActionRouter = lazy(() => import('./engine/ActionRouter'))

// Lazy-loaded pages — dashboards + auth only
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Login = lazy(() => import('./pages/Login'))
const AccountingDashboard = lazy(() => import('./pages/accounting/AccountingDashboard'))
const SalesDashboard = lazy(() => import('./pages/sales/SalesDashboard'))
const PurchaseDashboard = lazy(() => import('./pages/purchase/PurchaseDashboard'))
const InventoryDashboard = lazy(() => import('./pages/inventory/InventoryDashboard'))
const CrmDashboard = lazy(() => import('./pages/crm/CrmDashboard'))
const WebsiteDashboard = lazy(() => import('./pages/website/WebsiteDashboard'))
const HrDashboard = lazy(() => import('./pages/hr/HrDashboard'))
const ProjectDashboard = lazy(() => import('./pages/project/ProjectDashboard'))
const SettingsPage = lazy(() => import('./engine/SettingsPage'))
const ActivityDashboard = lazy(() => import('./engine/ActivityDashboard'))

// ---------------------------------------------------------------------------
// Boneyard skeleton descriptors for page-level loading
// ---------------------------------------------------------------------------

// Dashboard skeleton: header + 4 stat cards + 3 action cards
const dashboardDescriptor = {
  display: 'flex' as const,
  flexDirection: 'column' as const,
  gap: 32,
  children: [
    // Page header
    {
      display: 'flex' as const,
      flexDirection: 'column' as const,
      gap: 8,
      children: [
        { height: 14, maxWidth: 80, borderRadius: 4 },
        { height: 32, maxWidth: 280, borderRadius: 6 },
        { height: 16, maxWidth: 500, borderRadius: 4 },
      ],
    },
    // Stat cards row
    {
      display: 'flex' as const,
      gap: 16,
      children: [
        { height: 140, borderRadius: 24, leaf: true },
        { height: 140, borderRadius: 24, leaf: true },
        { height: 140, borderRadius: 24, leaf: true },
        { height: 140, borderRadius: 24, leaf: true },
      ],
    },
    // Action cards row
    {
      display: 'flex' as const,
      gap: 16,
      children: [
        { height: 180, borderRadius: 24, leaf: true },
        { height: 180, borderRadius: 24, leaf: true },
        { height: 180, borderRadius: 24, leaf: true },
      ],
    },
    // Health card
    { height: 160, borderRadius: 24, leaf: true },
  ],
}

// List page skeleton: header + filter bar + table rows
const listDescriptor = {
  display: 'flex' as const,
  flexDirection: 'column' as const,
  gap: 24,
  children: [
    // Page header
    {
      display: 'flex' as const,
      flexDirection: 'column' as const,
      gap: 8,
      children: [
        { height: 14, maxWidth: 80, borderRadius: 4 },
        { height: 28, maxWidth: 240, borderRadius: 6 },
      ],
    },
    // Table card
    {
      display: 'flex' as const,
      flexDirection: 'column' as const,
      borderRadius: 24,
      children: [
        // Filter bar
        { height: 56, borderRadius: 0, leaf: true },
        // Table header
        { height: 44, borderRadius: 0, leaf: true },
        // Table rows
        { height: 48, borderRadius: 0, leaf: true },
        { height: 48, borderRadius: 0, leaf: true },
        { height: 48, borderRadius: 0, leaf: true },
        { height: 48, borderRadius: 0, leaf: true },
        { height: 48, borderRadius: 0, leaf: true },
        { height: 48, borderRadius: 0, leaf: true },
        { height: 48, borderRadius: 0, leaf: true },
        { height: 48, borderRadius: 0, leaf: true },
      ],
    },
  ],
}

// Detail page skeleton: header + two-column info + table
const detailDescriptor = {
  display: 'flex' as const,
  flexDirection: 'column' as const,
  gap: 24,
  children: [
    // Back + title
    {
      display: 'flex' as const,
      flexDirection: 'column' as const,
      gap: 8,
      children: [
        { height: 14, maxWidth: 100, borderRadius: 4 },
        { height: 28, maxWidth: 300, borderRadius: 6 },
        { height: 16, maxWidth: 200, borderRadius: 4 },
      ],
    },
    // Status bar
    { height: 48, borderRadius: 24, leaf: true },
    // Two info cards side by side
    {
      display: 'flex' as const,
      gap: 16,
      children: [
        { height: 200, borderRadius: 24, leaf: true },
        { height: 200, borderRadius: 24, leaf: true },
      ],
    },
    // Lines table
    { height: 300, borderRadius: 24, leaf: true },
  ],
}

// Pre-compute bones at 1280px width
const dashboardBones = computeLayout(dashboardDescriptor, 1100, 'dashboard-loading')
const listBones = computeLayout(listDescriptor, 1100, 'list-loading')
const detailBones = computeLayout(detailDescriptor, 1100, 'detail-loading')

function LoadingFallback() {
  return (
    <BoneSkeleton name="page-loading" loading={true} initialBones={dashboardBones} animate="shimmer">
      <div />
    </BoneSkeleton>
  )
}

// Exported for use in individual pages
export { BoneSkeleton, dashboardBones, listBones, detailBones }

// Redirect helper for legacy URL patterns that include a dynamic :id segment
function LegacyRedirect({ model }: { model: string }) {
  const { id } = useParams<{ id: string }>()
  return <Navigate to={`/model/${model}/${id}`} replace />
}

export default function App() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />

          {/* Hand-coded dashboards (client actions) */}
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="sales" element={<SalesDashboard />} />
          <Route path="accounting" element={<AccountingDashboard />} />
          <Route path="purchase" element={<PurchaseDashboard />} />
          <Route path="inventory" element={<InventoryDashboard />} />
          <Route path="crm" element={<CrmDashboard />} />
          <Route path="hr" element={<HrDashboard />} />
          <Route path="projects" element={<ProjectDashboard />} />
          <Route path="website" element={<WebsiteDashboard />} />

          {/* Settings & Activities */}
          <Route path="settings" element={<SettingsPage />} />
          <Route path="activities" element={<ActivityDashboard />} />

          {/* Dynamic view engine routes */}
          <Route path="action/:actionId/*" element={<ActionRouter />} />
          <Route path="model/:model" element={<ActionRouter />} />
          <Route path="model/:model/:id" element={<ActionRouter />} />

          {/* Legacy URL redirects — map old paths to new dynamic routes */}
          <Route path="partners" element={<Navigate to="/model/res.partner" replace />} />
          <Route path="partners/:id" element={<LegacyRedirect model="res.partner" />} />
          <Route path="sales/orders" element={<Navigate to="/model/sale.order" replace />} />
          <Route path="sales/orders/:id" element={<LegacyRedirect model="sale.order" />} />
          <Route path="purchase/orders" element={<Navigate to="/model/purchase.order" replace />} />
          <Route path="purchase/orders/:id" element={<LegacyRedirect model="purchase.order" />} />
          <Route path="accounting/invoices" element={<Navigate to="/model/account.move" replace />} />
          <Route path="accounting/invoices/:id" element={<LegacyRedirect model="account.move" />} />
          <Route path="accounting/accounts" element={<Navigate to="/model/account.account" replace />} />
          <Route path="accounting/payments" element={<Navigate to="/model/account.payment" replace />} />
          <Route path="inventory/transfers" element={<Navigate to="/model/stock.picking" replace />} />
          <Route path="inventory/transfers/:id" element={<LegacyRedirect model="stock.picking" />} />
          <Route path="inventory/stock" element={<Navigate to="/model/stock.quant" replace />} />
          <Route path="crm/pipeline" element={<Navigate to="/model/crm.lead" replace />} />
          <Route path="crm/leads" element={<Navigate to="/model/crm.lead" replace />} />
          <Route path="crm/leads/:id" element={<LegacyRedirect model="crm.lead" />} />
          <Route path="hr/employees" element={<Navigate to="/model/hr.employee" replace />} />
          <Route path="hr/employees/:id" element={<LegacyRedirect model="hr.employee" />} />
          <Route path="hr/leaves" element={<Navigate to="/model/hr.leave" replace />} />
          <Route path="projects/list" element={<Navigate to="/model/project.project" replace />} />
          <Route path="projects/:id" element={<LegacyRedirect model="project.project" />} />
          <Route path="projects/tasks/:id" element={<LegacyRedirect model="project.task" />} />
          <Route path="website/products" element={<Navigate to="/model/product.template" replace />} />
          <Route path="website/products/:id" element={<LegacyRedirect model="product.template" />} />
          <Route path="website/pages" element={<Navigate to="/model/website.page" replace />} />
          <Route path="fleet" element={<Navigate to="/model/fleet.vehicle" replace />} />
          <Route path="repairs" element={<Navigate to="/model/repair.order" replace />} />
          <Route path="manufacturing" element={<Navigate to="/model/mrp.production" replace />} />
          <Route path="events" element={<Navigate to="/model/event.event" replace />} />
          <Route path="surveys" element={<Navigate to="/model/survey.survey" replace />} />
          <Route path="email-marketing" element={<Navigate to="/model/mailing.mailing" replace />} />
          <Route path="pos" element={<Navigate to="/model/pos.session" replace />} />
          <Route path="calendar" element={<Navigate to="/model/calendar.event" replace />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
