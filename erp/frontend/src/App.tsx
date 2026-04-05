import { Suspense, lazy } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Skeleton as BoneSkeleton } from 'boneyard-js/react'
import { computeLayout } from 'boneyard-js/layout'
import Layout from './components/Layout'

// Lazy-loaded pages
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Partners = lazy(() => import('./pages/Partners'))
const PartnerDetail = lazy(() => import('./pages/PartnerDetail'))
const Login = lazy(() => import('./pages/Login'))
const AccountingDashboard = lazy(() => import('./pages/accounting/AccountingDashboard'))
const InvoiceList = lazy(() => import('./pages/accounting/InvoiceList'))
const InvoiceDetail = lazy(() => import('./pages/accounting/InvoiceDetail'))
const ChartOfAccounts = lazy(() => import('./pages/accounting/ChartOfAccounts'))
const Payments = lazy(() => import('./pages/accounting/Payments'))
const SalesDashboard = lazy(() => import('./pages/sales/SalesDashboard'))
const SalesOrderList = lazy(() => import('./pages/sales/SalesOrderList'))
const SalesOrderDetail = lazy(() => import('./pages/sales/SalesOrderDetail'))
const PurchaseDashboard = lazy(() => import('./pages/purchase/PurchaseDashboard'))
const PurchaseOrderList = lazy(() => import('./pages/purchase/PurchaseOrderList'))
const PurchaseOrderDetail = lazy(() => import('./pages/purchase/PurchaseOrderDetail'))
const InventoryDashboard = lazy(() => import('./pages/inventory/InventoryDashboard'))
const TransferList = lazy(() => import('./pages/inventory/TransferList'))
const TransferDetail = lazy(() => import('./pages/inventory/TransferDetail'))
const StockLevels = lazy(() => import('./pages/inventory/StockLevels'))
const CrmDashboard = lazy(() => import('./pages/crm/CrmDashboard'))
const Pipeline = lazy(() => import('./pages/crm/Pipeline'))
const LeadList = lazy(() => import('./pages/crm/LeadList'))
const LeadDetail = lazy(() => import('./pages/crm/LeadDetail'))
const WebsiteDashboard = lazy(() => import('./pages/website/WebsiteDashboard'))
const ProductCatalog = lazy(() => import('./pages/website/ProductCatalog'))
const ProductDetailPage = lazy(() => import('./pages/website/ProductDetail'))
const CmsPages = lazy(() => import('./pages/website/CmsPages'))
const HrDashboard = lazy(() => import('./pages/hr/HrDashboard'))
const EmployeeList = lazy(() => import('./pages/hr/EmployeeList'))
const EmployeeDetail = lazy(() => import('./pages/hr/EmployeeDetail'))
const LeaveRequests = lazy(() => import('./pages/hr/LeaveRequests'))
const ProjectDashboard = lazy(() => import('./pages/project/ProjectDashboard'))
const ProjectList = lazy(() => import('./pages/project/ProjectList'))
const ProjectDetail = lazy(() => import('./pages/project/ProjectDetail'))
const TaskDetail = lazy(() => import('./pages/project/TaskDetail'))
const Fleet = lazy(() => import('./pages/secondary/Fleet'))
const Repairs = lazy(() => import('./pages/secondary/Repairs'))
const Manufacturing = lazy(() => import('./pages/secondary/Manufacturing'))
const Events = lazy(() => import('./pages/secondary/Events'))
const Surveys = lazy(() => import('./pages/secondary/Surveys'))
const EmailMarketing = lazy(() => import('./pages/secondary/EmailMarketing'))
const PointOfSale = lazy(() => import('./pages/secondary/PointOfSale'))
const CalendarPage = lazy(() => import('./pages/secondary/CalendarPage'))

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

export default function App() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="partners" element={<Partners />} />
          <Route path="partners/:id" element={<PartnerDetail />} />
          <Route path="accounting" element={<AccountingDashboard />} />
          <Route path="accounting/invoices" element={<InvoiceList />} />
          <Route path="accounting/invoices/:id" element={<InvoiceDetail />} />
          <Route path="accounting/accounts" element={<ChartOfAccounts />} />
          <Route path="accounting/payments" element={<Payments />} />
          <Route path="sales" element={<SalesDashboard />} />
          <Route path="sales/orders" element={<SalesOrderList />} />
          <Route path="sales/orders/:id" element={<SalesOrderDetail />} />
          <Route path="purchase" element={<PurchaseDashboard />} />
          <Route path="purchase/orders" element={<PurchaseOrderList />} />
          <Route path="purchase/orders/:id" element={<PurchaseOrderDetail />} />
          <Route path="inventory" element={<InventoryDashboard />} />
          <Route path="inventory/transfers" element={<TransferList />} />
          <Route path="inventory/transfers/:id" element={<TransferDetail />} />
          <Route path="inventory/stock" element={<StockLevels />} />
          <Route path="crm" element={<CrmDashboard />} />
          <Route path="crm/pipeline" element={<Pipeline />} />
          <Route path="crm/leads" element={<LeadList />} />
          <Route path="crm/leads/:id" element={<LeadDetail />} />
          <Route path="website" element={<WebsiteDashboard />} />
          <Route path="website/products" element={<ProductCatalog />} />
          <Route path="website/products/:id" element={<ProductDetailPage />} />
          <Route path="website/pages" element={<CmsPages />} />
          <Route path="hr" element={<HrDashboard />} />
          <Route path="hr/employees" element={<EmployeeList />} />
          <Route path="hr/employees/:id" element={<EmployeeDetail />} />
          <Route path="hr/leaves" element={<LeaveRequests />} />
          <Route path="projects" element={<ProjectDashboard />} />
          <Route path="projects/list" element={<ProjectList />} />
          <Route path="projects/:id" element={<ProjectDetail />} />
          <Route path="projects/tasks/:id" element={<TaskDetail />} />
          <Route path="fleet" element={<Fleet />} />
          <Route path="repairs" element={<Repairs />} />
          <Route path="manufacturing" element={<Manufacturing />} />
          <Route path="events" element={<Events />} />
          <Route path="surveys" element={<Surveys />} />
          <Route path="email-marketing" element={<EmailMarketing />} />
          <Route path="pos" element={<PointOfSale />} />
          <Route path="calendar" element={<CalendarPage />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
