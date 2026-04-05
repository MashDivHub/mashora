import { Suspense, lazy } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
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

function LoadingFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="animate-pulse rounded-3xl border border-border/60 bg-card/90 shadow-xl px-6 py-4 flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-zinc-900 text-white text-sm font-bold select-none">
          M
        </div>
        <span className="text-sm text-muted-foreground">Loading...</span>
      </div>
    </div>
  )
}

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
