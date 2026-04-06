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
const SettingsPage = lazy(() => import('./pages/settings/GeneralSettings'))
const ActivityDashboard = lazy(() => import('./engine/ActivityDashboard'))

// Module pages — Contacts
const ContactList = lazy(() => import('./pages/contacts/ContactList'))
const ContactForm = lazy(() => import('./pages/contacts/ContactForm'))
const ContactTags = lazy(() => import('./pages/contacts/ContactTags'))

// Module pages — CRM
const CrmPipeline = lazy(() => import('./pages/crm/Pipeline'))
const CrmLeadList = lazy(() => import('./pages/crm/LeadList'))
const CrmLeadDetail = lazy(() => import('./pages/crm/LeadDetail'))

// Module pages — Sales
const SalesOrderList = lazy(() => import('./pages/sales/SalesOrderList'))
const SalesOrderDetail = lazy(() => import('./pages/sales/SalesOrderDetail'))
const LoyaltyPrograms = lazy(() => import('./pages/sales/LoyaltyPrograms'))
const LoyaltyProgramDetail = lazy(() => import('./pages/sales/LoyaltyProgramDetail'))
const MarginAnalysis = lazy(() => import('./pages/sales/MarginAnalysis'))
const SalesTeams = lazy(() => import('./pages/sales/SalesTeams'))

// Module pages — Purchase
const PurchaseOrderList = lazy(() => import('./pages/purchase/PurchaseOrderList'))
const PurchaseOrderDetail = lazy(() => import('./pages/purchase/PurchaseOrderDetail'))

// Module pages — Invoicing & Accounting
const InvoiceList = lazy(() => import('./pages/accounting/InvoiceList'))
const InvoiceDetail = lazy(() => import('./pages/accounting/InvoiceDetail'))
const PaymentsList = lazy(() => import('./pages/accounting/Payments'))
const ChartOfAccounts = lazy(() => import('./pages/accounting/ChartOfAccounts'))
const TrialBalance = lazy(() => import('./pages/accounting/TrialBalance'))
const ProfitLoss = lazy(() => import('./pages/accounting/ProfitLoss'))
const BalanceSheet = lazy(() => import('./pages/accounting/BalanceSheet'))
const AgedReceivable = lazy(() => import('./pages/accounting/AgedReceivable'))
const AgedPayable = lazy(() => import('./pages/accounting/AgedPayable'))
const JournalEntries = lazy(() => import('./pages/accounting/JournalEntries'))
const BankStatements = lazy(() => import('./pages/accounting/BankStatements'))
const JournalList = lazy(() => import('./pages/accounting/JournalList'))

// Module pages — Inventory
const TransferList = lazy(() => import('./pages/inventory/TransferList'))
const TransferDetail = lazy(() => import('./pages/inventory/TransferDetail'))
const StockLevels = lazy(() => import('./pages/inventory/StockLevels'))

// Module pages — Project
const ProjectList = lazy(() => import('./pages/project/ProjectList'))
const ProjectDetailPage = lazy(() => import('./pages/project/ProjectDetail'))
const TaskList = lazy(() => import('./pages/project/TaskList'))
const TaskDetailPage = lazy(() => import('./pages/project/TaskDetail'))

// Module pages — HR
const EmployeeList = lazy(() => import('./pages/hr/EmployeeList'))
const EmployeeDetailPage = lazy(() => import('./pages/hr/EmployeeDetail'))
const DepartmentList = lazy(() => import('./pages/hr/DepartmentList'))
const AttendanceList = lazy(() => import('./pages/hr/AttendanceList'))
const LeaveList = lazy(() => import('./pages/hr/LeaveList'))
const LeaveDetail = lazy(() => import('./pages/hr/LeaveDetail'))
const AllocationList = lazy(() => import('./pages/hr/AllocationList'))
const ExpenseList = lazy(() => import('./pages/hr/ExpenseList'))
const ExpenseSheetList = lazy(() => import('./pages/hr/ExpenseSheetList'))
const JobList = lazy(() => import('./pages/hr/JobList'))

// Module pages — Manufacturing
const MrpDashboard = lazy(() => import('./pages/manufacturing/MrpDashboard'))
const ProductionList = lazy(() => import('./pages/manufacturing/ProductionList'))
const ProductionDetail = lazy(() => import('./pages/manufacturing/ProductionDetail'))
const BomList = lazy(() => import('./pages/manufacturing/BomList'))
const BomDetail = lazy(() => import('./pages/manufacturing/BomDetail'))
const WorkCenterList = lazy(() => import('./pages/manufacturing/WorkCenterList'))
const WorkOrderList = lazy(() => import('./pages/manufacturing/WorkOrderList'))

// Module pages — Calendar, Website, Discuss
const CalendarPage = lazy(() => import('./pages/secondary/CalendarPage'))
const CmsPages = lazy(() => import('./pages/website/CmsPages'))
const DiscussPage = lazy(() => import('./pages/discuss/DiscussPage'))

// Module pages — Secondary (lazy-loaded)
const Fleet = lazy(() => import('./pages/secondary/Fleet'))
const Repairs = lazy(() => import('./pages/secondary/Repairs'))
const Manufacturing = lazy(() => import('./pages/secondary/Manufacturing'))
const Events = lazy(() => import('./pages/secondary/Events'))
const Surveys = lazy(() => import('./pages/secondary/Surveys'))
const EmailMarketing = lazy(() => import('./pages/secondary/EmailMarketing'))
const PointOfSale = lazy(() => import('./pages/secondary/PointOfSale'))

// Module pages — POS (purpose-built)
const PosDashboard = lazy(() => import('./pages/pos/PosDashboard'))
const PosSessionList = lazy(() => import('./pages/pos/PosSessionList'))
const PosSessionDetail = lazy(() => import('./pages/pos/PosSessionDetail'))
const PosOrderList = lazy(() => import('./pages/pos/PosOrderList'))
const PosOrderDetail = lazy(() => import('./pages/pos/PosOrderDetail'))
const PosConfig = lazy(() => import('./pages/pos/PosConfig'))

// Module pages — Settings
const SettingsDashboard = lazy(() => import('./pages/settings/SettingsDashboard'))
const UserList = lazy(() => import('./pages/settings/UserList'))
const UserForm = lazy(() => import('./pages/settings/UserForm'))
const CompanyList = lazy(() => import('./pages/settings/CompanyList'))

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

          {/* Settings */}
          <Route path="settings" element={<SettingsDashboard />} />
          <Route path="settings/general" element={<SettingsPage />} />
          <Route path="settings/users" element={<UserList />} />
          <Route path="settings/users/:id" element={<UserForm />} />
          <Route path="settings/companies" element={<CompanyList />} />

          {/* Activities */}
          <Route path="activities" element={<ActivityDashboard />} />

          {/* Contacts module */}
          <Route path="contacts" element={<ContactList />} />
          <Route path="contacts/tags" element={<ContactTags />} />
          <Route path="contacts/:id" element={<ContactForm />} />

          {/* CRM module */}
          <Route path="crm/pipeline" element={<CrmPipeline />} />
          <Route path="crm/leads" element={<CrmLeadList />} />
          <Route path="crm/leads/:id" element={<CrmLeadDetail />} />

          {/* Sales module */}
          <Route path="sales/orders" element={<SalesOrderList />} />
          <Route path="sales/orders/:id" element={<SalesOrderDetail />} />
          <Route path="sales/orders/:id/margin" element={<MarginAnalysis />} />
          <Route path="sales/loyalty" element={<LoyaltyPrograms />} />
          <Route path="sales/loyalty/:id" element={<LoyaltyProgramDetail />} />
          <Route path="sales/teams" element={<SalesTeams />} />

          {/* Purchase module */}
          <Route path="purchase/orders" element={<PurchaseOrderList />} />
          <Route path="purchase/orders/:id" element={<PurchaseOrderDetail />} />

          {/* Invoicing module */}
          <Route path="invoicing/invoices" element={<InvoiceList />} />
          <Route path="invoicing/invoices/:id" element={<InvoiceDetail />} />
          <Route path="invoicing/payments" element={<PaymentsList />} />

          {/* Accounting module */}
          <Route path="accounting/accounts" element={<ChartOfAccounts />} />
          <Route path="accounting/journals" element={<JournalList />} />
          <Route path="accounting/entries" element={<JournalEntries />} />
          <Route path="accounting/bank" element={<BankStatements />} />
          <Route path="accounting/reports/trial-balance" element={<TrialBalance />} />
          <Route path="accounting/reports/profit-loss" element={<ProfitLoss />} />
          <Route path="accounting/reports/balance-sheet" element={<BalanceSheet />} />
          <Route path="accounting/reports/aged-receivable" element={<AgedReceivable />} />
          <Route path="accounting/reports/aged-payable" element={<AgedPayable />} />

          {/* Inventory module */}
          <Route path="inventory/transfers" element={<TransferList />} />
          <Route path="inventory/transfers/:id" element={<TransferDetail />} />
          <Route path="inventory/stock" element={<StockLevels />} />
          <Route path="inventory/receipts" element={<Navigate to="/inventory/transfers?filter=receipts" replace />} />
          <Route path="inventory/deliveries" element={<Navigate to="/inventory/transfers?filter=deliveries" replace />} />
          <Route path="inventory/internal" element={<Navigate to="/inventory/transfers?filter=internal" replace />} />

          {/* Project module */}
          <Route path="projects/list" element={<ProjectList />} />
          <Route path="projects/tasks" element={<TaskList />} />
          <Route path="projects/tasks/:id" element={<TaskDetailPage />} />
          <Route path="projects/:id" element={<ProjectDetailPage />} />

          {/* HR module */}
          <Route path="hr/employees" element={<EmployeeList />} />
          <Route path="hr/employees/:id" element={<EmployeeDetailPage />} />
          <Route path="hr/departments" element={<DepartmentList />} />
          <Route path="hr/attendance" element={<AttendanceList />} />
          <Route path="hr/leaves" element={<LeaveList />} />
          <Route path="hr/leaves/:id" element={<LeaveDetail />} />
          <Route path="hr/allocations" element={<AllocationList />} />
          <Route path="hr/expenses" element={<ExpenseList />} />
          <Route path="hr/expense-sheets" element={<ExpenseSheetList />} />
          <Route path="hr/jobs" element={<JobList />} />

          {/* Calendar, Website, Discuss */}
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="website/pages" element={<CmsPages />} />
          <Route path="discuss" element={<DiscussPage />} />

          {/* Secondary modules — purpose-built pages */}
          <Route path="fleet" element={<Fleet />} />
          <Route path="repairs" element={<Repairs />} />
          {/* Manufacturing module */}
          <Route path="manufacturing" element={<MrpDashboard />} />
          <Route path="manufacturing/orders" element={<ProductionList />} />
          <Route path="manufacturing/orders/:id" element={<ProductionDetail />} />
          <Route path="manufacturing/bom" element={<BomList />} />
          <Route path="manufacturing/bom/:id" element={<BomDetail />} />
          <Route path="manufacturing/workcenters" element={<WorkCenterList />} />
          <Route path="manufacturing/workorders" element={<WorkOrderList />} />
          <Route path="events" element={<Events />} />
          <Route path="surveys" element={<Surveys />} />
          <Route path="email-marketing" element={<EmailMarketing />} />
          {/* POS module */}
          <Route path="pos" element={<PosDashboard />} />
          <Route path="pos/sessions" element={<PosSessionList />} />
          <Route path="pos/sessions/:id" element={<PosSessionDetail />} />
          <Route path="pos/orders" element={<PosOrderList />} />
          <Route path="pos/orders/:id" element={<PosOrderDetail />} />
          <Route path="pos/config" element={<PosConfig />} />

          {/* Dynamic view engine routes */}
          <Route path="action/:actionId/*" element={<ActionRouter />} />
          <Route path="model/:model" element={<ActionRouter />} />
          <Route path="model/:model/:id" element={<ActionRouter />} />

          {/* Legacy URL redirects — only paths with no hand-coded equivalent */}
          <Route path="partners" element={<Navigate to="/contacts" replace />} />
          <Route path="partners/:id" element={<LegacyRedirect model="res.partner" />} />
          <Route path="accounting/invoices" element={<Navigate to="/invoicing/invoices" replace />} />
          <Route path="accounting/invoices/:id" element={<LegacyRedirect model="account.move" />} />
          <Route path="accounting/accounts" element={<Navigate to="/model/account.account" replace />} />
          <Route path="accounting/payments" element={<Navigate to="/invoicing/payments" replace />} />
          <Route path="hr/leaves" element={<Navigate to="/model/hr.leave" replace />} />
          <Route path="website/products" element={<Navigate to="/model/product.template" replace />} />
          <Route path="website/products/:id" element={<LegacyRedirect model="product.template" />} />

          {/* 404 catch-all */}
          <Route path="*" element={
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <h1 className="text-4xl font-bold text-foreground mb-2">404</h1>
              <p className="text-muted-foreground mb-4">Page not found</p>
              <a href="/dashboard" className="text-primary hover:underline text-sm">Go to Dashboard</a>
            </div>
          } />
        </Route>
      </Routes>
    </Suspense>
  )
}
