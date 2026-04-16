import { Suspense, lazy, useEffect } from 'react'
import { Routes, Route, Navigate, useParams } from 'react-router-dom'
import { Skeleton as BoneSkeleton } from 'boneyard-js/react'
import { computeLayout } from 'boneyard-js/layout'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import { useAuthStore } from './engine/AuthStore'

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
const CrmActivities = lazy(() => import('./pages/crm/CrmActivities'))
const LostReasons = lazy(() => import('./pages/crm/LostReasons'))
const StageList = lazy(() => import('./pages/crm/StageList'))

// Module pages — Sales
const SalesOrderList = lazy(() => import('./pages/sales/SalesOrderList'))
const SalesOrderDetail = lazy(() => import('./pages/sales/SalesOrderDetail'))
const LoyaltyPrograms = lazy(() => import('./pages/sales/LoyaltyPrograms'))
const LoyaltyProgramDetail = lazy(() => import('./pages/sales/LoyaltyProgramDetail'))
const MarginAnalysis = lazy(() => import('./pages/sales/MarginAnalysis'))
const SalesTeams = lazy(() => import('./pages/sales/SalesTeams'))
const SalesCommission = lazy(() => import('./pages/sales/SalesCommission'))

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
const TaxConfig = lazy(() => import('./pages/accounting/TaxConfig'))
const BankReconciliation = lazy(() => import('./pages/accounting/BankReconciliation'))

// Module pages — Inventory
const TransferList = lazy(() => import('./pages/inventory/TransferList'))
const TransferDetail = lazy(() => import('./pages/inventory/TransferDetail'))
const StockLevels = lazy(() => import('./pages/inventory/StockLevels'))
const LotSerialList = lazy(() => import('./pages/inventory/LotSerialList'))
const ScrapOrders = lazy(() => import('./pages/inventory/ScrapOrders'))
const InventoryAdjustment = lazy(() => import('./pages/inventory/InventoryAdjustment'))
const WarehouseConfig = lazy(() => import('./pages/inventory/WarehouseConfig'))
const LocationList = lazy(() => import('./pages/inventory/LocationList'))
const ReplenishmentRules = lazy(() => import('./pages/inventory/ReplenishmentRules'))
const InventoryValuation = lazy(() => import('./pages/inventory/InventoryValuation'))
const BatchPicking = lazy(() => import('./pages/inventory/BatchPicking'))

// Module pages — Project
const ProjectList = lazy(() => import('./pages/project/ProjectList'))
const ProjectDetailPage = lazy(() => import('./pages/project/ProjectDetail'))
const TaskList = lazy(() => import('./pages/project/TaskList'))
const TaskDetailPage = lazy(() => import('./pages/project/TaskDetail'))
const TimesheetList = lazy(() => import('./pages/project/TimesheetList'))
const TimesheetSummary = lazy(() => import('./pages/project/TimesheetSummary'))
const MilestoneList = lazy(() => import('./pages/project/MilestoneList'))
const ProjectUpdates = lazy(() => import('./pages/project/ProjectUpdates'))
const TaskStages = lazy(() => import('./pages/project/TaskStages'))
const ProjectBilling = lazy(() => import('./pages/project/ProjectBilling'))
const ProjectTodoList = lazy(() => import('./pages/project/ProjectTodoList'))

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
const LeaveTypes = lazy(() => import('./pages/hr/LeaveTypes'))
const OrgChart = lazy(() => import('./pages/hr/OrgChart'))
const SkillsMatrix = lazy(() => import('./pages/hr/SkillsMatrix'))
const WorkEntries = lazy(() => import('./pages/hr/WorkEntries'))
const HomeworkingSchedule = lazy(() => import('./pages/hr/HomeworkingSchedule'))

// Module pages — Manufacturing
const MrpDashboard = lazy(() => import('./pages/manufacturing/MrpDashboard'))
const ProductionList = lazy(() => import('./pages/manufacturing/ProductionList'))
const ProductionDetail = lazy(() => import('./pages/manufacturing/ProductionDetail'))
const BomList = lazy(() => import('./pages/manufacturing/BomList'))
const BomDetail = lazy(() => import('./pages/manufacturing/BomDetail'))
const WorkCenterList = lazy(() => import('./pages/manufacturing/WorkCenterList'))
const WorkOrderList = lazy(() => import('./pages/manufacturing/WorkOrderList'))
const WorkOrderTerminal = lazy(() => import('./pages/manufacturing/WorkOrderTerminal'))
const SubcontractingList = lazy(() => import('./pages/manufacturing/SubcontractingList'))

// Module pages — Calendar, Website, Discuss
const CalendarPage = lazy(() => import('./pages/secondary/CalendarPage'))
const CmsPages = lazy(() => import('./pages/website/CmsPages'))
const WebsiteMenus = lazy(() => import('./pages/website/WebsiteMenus'))
const CategoryManager = lazy(() => import('./pages/website/CategoryManager'))
const ProductsDashboard = lazy(() => import('./pages/products/ProductsDashboard'))
const PricelistManager = lazy(() => import('./pages/products/PricelistManager'))
const VariantList = lazy(() => import('./pages/products/VariantList'))
const BundleList = lazy(() => import('./pages/products/BundleList'))
const BlogList = lazy(() => import('./pages/website/BlogList'))
const BlogDetail = lazy(() => import('./pages/website/BlogDetail'))
const EcomOrders = lazy(() => import('./pages/website/EcomOrders'))
const ProductEditor = lazy(() => import('./pages/website/ProductEditor'))
const VisitorAnalytics = lazy(() => import('./pages/website/VisitorAnalytics'))
const CourseList = lazy(() => import('./pages/website/CourseList'))
const ForumManager = lazy(() => import('./pages/website/ForumManager'))
const ProductCatalog = lazy(() => import('./pages/website/ProductCatalog'))
const DiscussPage = lazy(() => import('./pages/discuss/DiscussPage'))

// Module pages — Events
const EventList = lazy(() => import('./pages/events/EventList'))
const EventDetail = lazy(() => import('./pages/events/EventDetail'))
const EventRegistrations = lazy(() => import('./pages/events/EventRegistrations'))
const EventTracks = lazy(() => import('./pages/events/EventTracks'))

// Module pages — Surveys
const SurveyList = lazy(() => import('./pages/surveys/SurveyList'))
const SurveyDetail = lazy(() => import('./pages/surveys/SurveyDetail'))
const SurveyResponses = lazy(() => import('./pages/surveys/SurveyResponses'))

// Module pages — Dashboards & Spreadsheets
const DashboardListPage = lazy(() => import('./pages/dashboards/DashboardList'))
const DashboardView = lazy(() => import('./pages/dashboards/DashboardView'))
const SpreadsheetList = lazy(() => import('./pages/dashboards/SpreadsheetList'))
const ReportCenter = lazy(() => import('./pages/dashboards/ReportCenter'))

// Module pages — Fleet & Maintenance
const FleetList = lazy(() => import('./pages/fleet/FleetList'))
const FleetDetail = lazy(() => import('./pages/fleet/FleetDetail'))
const FleetCosts = lazy(() => import('./pages/fleet/FleetCosts'))
const MaintenanceRequests = lazy(() => import('./pages/fleet/MaintenanceRequests'))
const EquipmentList = lazy(() => import('./pages/fleet/EquipmentList'))
const MaintenanceCalendar = lazy(() => import('./pages/fleet/MaintenanceCalendar'))
const FleetContracts = lazy(() => import('./pages/fleet/FleetContracts'))
const MaintenanceDetail = lazy(() => import('./pages/fleet/MaintenanceDetail'))

// Module pages — Email Marketing
const CampaignList = lazy(() => import('./pages/marketing/CampaignList'))
const CampaignDetail = lazy(() => import('./pages/marketing/CampaignDetail'))
const MailingLists = lazy(() => import('./pages/marketing/MailingLists'))
const TemplateGallery = lazy(() => import('./pages/marketing/TemplateGallery'))

// Module pages — Secondary (lazy-loaded, kept for fallback)
const Repairs = lazy(() => import('./pages/secondary/Repairs'))

// Module pages — POS (purpose-built)
const PosDashboard = lazy(() => import('./pages/pos/PosDashboard'))
const PosSessionList = lazy(() => import('./pages/pos/PosSessionList'))
const PosSessionDetail = lazy(() => import('./pages/pos/PosSessionDetail'))
const PosOrderList = lazy(() => import('./pages/pos/PosOrderList'))
const PosOrderDetail = lazy(() => import('./pages/pos/PosOrderDetail'))
const PosConfig = lazy(() => import('./pages/pos/PosConfig'))
const PosTerminal = lazy(() => import('./pages/pos/PosTerminal'))
const PosRestaurant = lazy(() => import('./pages/pos/PosRestaurant'))

// Public website pages
const WebsiteLayout = lazy(() => import('./components/WebsiteLayout'))
const Home = lazy(() => import('./pages/public/Home'))
const Shop = lazy(() => import('./pages/public/Shop'))
const ShopProduct = lazy(() => import('./pages/public/ShopProduct'))
const Blog = lazy(() => import('./pages/public/Blog'))
const BlogPost = lazy(() => import('./pages/public/BlogPost'))
const ContactUs = lazy(() => import('./pages/public/ContactUs'))

// Module pages — Settings
const SettingsDashboard = lazy(() => import('./pages/settings/SettingsDashboard'))
const UserList = lazy(() => import('./pages/settings/UserList'))
const UserForm = lazy(() => import('./pages/settings/UserForm'))
const CompanyList = lazy(() => import('./pages/settings/CompanyList'))
const GoogleCalendarSync = lazy(() => import('./pages/settings/GoogleCalendarSync'))
const MicrosoftCalendarSync = lazy(() => import('./pages/settings/MicrosoftCalendarSync'))
const StripeConfig = lazy(() => import('./pages/settings/StripeConfig'))
const SmsConfig = lazy(() => import('./pages/settings/SmsConfig'))
const GroupsManager = lazy(() => import('./pages/settings/GroupsManager'))
const AccessRights = lazy(() => import('./pages/settings/AccessRights'))
const RecordRules = lazy(() => import('./pages/settings/RecordRules'))

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
  return <Navigate to={`/admin/model/${model}/${id}`} replace />
}

export default function App() {
  useEffect(() => {
    useAuthStore.getState().fetchUser()
  }, [])

  return (
    <Suspense fallback={<LoadingFallback />}>
      <Routes>
        <Route path="/login" element={<Login />} />

        {/* Public website */}
        <Route element={<WebsiteLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/shop/:slug" element={<ShopProduct />} />
          <Route path="/blog" element={<Blog />} />
          <Route path="/blog/:slug" element={<BlogPost />} />
          <Route path="/contactus" element={<ContactUs />} />
        </Route>

        {/* Admin */}
        <Route path="/admin" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Navigate to="/admin/dashboard" replace />} />

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
          <Route path="settings/groups" element={<GroupsManager />} />
          <Route path="settings/groups/:id" element={<GroupsManager />} />
          <Route path="settings/access-rights" element={<AccessRights />} />
          <Route path="settings/record-rules" element={<RecordRules />} />
          <Route path="settings/integrations/google" element={<GoogleCalendarSync />} />
          <Route path="settings/integrations/microsoft" element={<MicrosoftCalendarSync />} />
          <Route path="settings/integrations/stripe" element={<StripeConfig />} />
          <Route path="settings/integrations/sms" element={<SmsConfig />} />

          {/* Activities */}
          <Route path="activities" element={<ActivityDashboard />} />

          {/* Contacts module */}
          <Route path="contacts" element={<ContactList />} />
          <Route path="contacts/tags" element={<ContactTags />} />
          <Route path="contacts/:id" element={<ContactForm />} />

          {/* Products module */}
          <Route path="products" element={<ProductsDashboard />} />
          <Route path="products/list" element={<ProductCatalog />} />
          <Route path="products/categories" element={<CategoryManager />} />
          <Route path="products/pricelists" element={<PricelistManager />} />
          <Route path="products/variants" element={<VariantList />} />
          <Route path="products/bundles" element={<BundleList />} />
          <Route path="products/new" element={<ProductEditor />} />
          <Route path="products/:id" element={<ProductEditor />} />

          {/* CRM module */}
          <Route path="crm/pipeline" element={<CrmPipeline />} />
          <Route path="crm/leads" element={<CrmLeadList />} />
          <Route path="crm/leads/:id" element={<CrmLeadDetail />} />
          <Route path="crm/activities" element={<CrmActivities />} />
          <Route path="crm/stages" element={<StageList />} />
          <Route path="crm/lost-reasons" element={<LostReasons />} />

          {/* Sales module */}
          <Route path="sales/orders" element={<SalesOrderList />} />
          <Route path="sales/orders/:id" element={<SalesOrderDetail />} />
          <Route path="sales/orders/:id/margin" element={<MarginAnalysis />} />
          <Route path="sales/loyalty" element={<LoyaltyPrograms />} />
          <Route path="sales/loyalty/:id" element={<LoyaltyProgramDetail />} />
          <Route path="sales/teams" element={<SalesTeams />} />
          <Route path="sales/commission" element={<SalesCommission />} />
          <Route path="sales/products" element={<ProductCatalog />} />

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
          <Route path="accounting/taxes" element={<TaxConfig />} />
          <Route path="accounting/bank/:id/reconcile" element={<BankReconciliation />} />

          {/* Inventory module */}
          <Route path="inventory/transfers" element={<TransferList />} />
          <Route path="inventory/transfers/:id" element={<TransferDetail />} />
          <Route path="inventory/stock" element={<StockLevels />} />
          <Route path="inventory/receipts" element={<Navigate to="/admin/inventory/transfers?filter=receipts" replace />} />
          <Route path="inventory/deliveries" element={<Navigate to="/admin/inventory/transfers?filter=deliveries" replace />} />
          <Route path="inventory/internal" element={<Navigate to="/admin/inventory/transfers?filter=internal" replace />} />
          <Route path="inventory/lots" element={<LotSerialList />} />
          <Route path="inventory/scrap" element={<ScrapOrders />} />
          <Route path="inventory/adjustments" element={<InventoryAdjustment />} />
          <Route path="inventory/warehouses" element={<WarehouseConfig />} />
          <Route path="inventory/locations" element={<LocationList />} />
          <Route path="inventory/replenishment" element={<ReplenishmentRules />} />
          <Route path="inventory/products" element={<ProductCatalog />} />
          <Route path="inventory/valuation" element={<InventoryValuation />} />
          <Route path="inventory/batch" element={<BatchPicking />} />

          {/* Project module */}
          <Route path="projects/list" element={<ProjectList />} />
          <Route path="projects/tasks" element={<TaskList />} />
          <Route path="projects/tasks/:id" element={<TaskDetailPage />} />
          <Route path="projects/:id" element={<ProjectDetailPage />} />
          <Route path="projects/timesheets" element={<TimesheetList />} />
          <Route path="projects/timesheets/summary" element={<TimesheetSummary />} />
          <Route path="projects/milestones" element={<MilestoneList />} />
          <Route path="projects/updates" element={<ProjectUpdates />} />
          <Route path="projects/stages" element={<TaskStages />} />
          <Route path="projects/billing" element={<ProjectBilling />} />
          <Route path="projects/todos" element={<ProjectTodoList />} />

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
          <Route path="hr/leave-types" element={<LeaveTypes />} />
          <Route path="hr/org-chart" element={<OrgChart />} />
          <Route path="hr/skills" element={<SkillsMatrix />} />
          <Route path="hr/work-entries" element={<WorkEntries />} />
          <Route path="hr/homeworking" element={<HomeworkingSchedule />} />

          {/* Calendar, Website, Discuss */}
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="website/pages" element={<CmsPages />} />
          <Route path="website/menus" element={<WebsiteMenus />} />
          <Route path="website/categories" element={<CategoryManager />} />
          <Route path="website/blog" element={<BlogList />} />
          <Route path="website/blog/:id" element={<BlogDetail />} />
          <Route path="website/orders" element={<EcomOrders />} />
          <Route path="website/products" element={<ProductCatalog />} />
          <Route path="website/products/:id" element={<ProductEditor />} />
          <Route path="website/analytics" element={<VisitorAnalytics />} />
          <Route path="website/courses" element={<CourseList />} />
          <Route path="website/forum" element={<ForumManager />} />
          <Route path="discuss" element={<DiscussPage />} />

          {/* Secondary modules — purpose-built pages */}
          {/* Fleet module */}
          <Route path="fleet" element={<FleetList />} />
          <Route path="fleet/:id" element={<FleetDetail />} />
          <Route path="fleet/:id/costs" element={<FleetCosts />} />
          <Route path="repairs" element={<Repairs />} />

          {/* Maintenance module */}
          <Route path="maintenance" element={<MaintenanceRequests />} />
          <Route path="maintenance/equipment" element={<EquipmentList />} />
          <Route path="maintenance/calendar" element={<MaintenanceCalendar />} />
          <Route path="maintenance/:id" element={<MaintenanceDetail />} />
          <Route path="fleet/contracts" element={<FleetContracts />} />
          {/* Manufacturing module */}
          <Route path="manufacturing" element={<MrpDashboard />} />
          <Route path="manufacturing/orders" element={<ProductionList />} />
          <Route path="manufacturing/orders/:id" element={<ProductionDetail />} />
          <Route path="manufacturing/bom" element={<BomList />} />
          <Route path="manufacturing/bom/:id" element={<BomDetail />} />
          <Route path="manufacturing/workcenters" element={<WorkCenterList />} />
          <Route path="manufacturing/workorders" element={<WorkOrderList />} />
          <Route path="manufacturing/workorders/:id" element={<WorkOrderTerminal />} />
          <Route path="manufacturing/subcontracting" element={<SubcontractingList />} />
          {/* Events module */}
          <Route path="events" element={<EventList />} />
          <Route path="events/:id" element={<EventDetail />} />
          <Route path="events/:id/registrations" element={<EventRegistrations />} />
          <Route path="events/:id/tracks" element={<EventTracks />} />

          {/* Surveys module */}
          <Route path="surveys" element={<SurveyList />} />
          <Route path="surveys/:id" element={<SurveyDetail />} />
          <Route path="surveys/:id/responses" element={<SurveyResponses />} />
          {/* Email Marketing module */}
          <Route path="email-marketing" element={<CampaignList />} />
          <Route path="email-marketing/:id" element={<CampaignDetail />} />
          <Route path="email-marketing/lists" element={<MailingLists />} />
          <Route path="email-marketing/templates" element={<TemplateGallery />} />

          {/* POS module */}
          <Route path="pos" element={<PosDashboard />} />
          <Route path="pos/sessions" element={<PosSessionList />} />
          <Route path="pos/sessions/:id" element={<PosSessionDetail />} />
          <Route path="pos/orders" element={<PosOrderList />} />
          <Route path="pos/orders/:id" element={<PosOrderDetail />} />
          <Route path="pos/config" element={<PosConfig />} />
          <Route path="pos/terminal/:configId" element={<PosTerminal />} />
          <Route path="pos/restaurant" element={<PosRestaurant />} />

          {/* Dashboards & Spreadsheets */}
          <Route path="dashboards" element={<DashboardListPage />} />
          <Route path="dashboards/:id" element={<DashboardView />} />
          <Route path="spreadsheets" element={<SpreadsheetList />} />
          <Route path="reports" element={<ReportCenter />} />

          {/* Dynamic view engine routes */}
          <Route path="action/:actionId/*" element={<ActionRouter />} />
          <Route path="model/:model" element={<ActionRouter />} />
          <Route path="model/:model/:id" element={<ActionRouter />} />

          {/* Legacy URL redirects — only paths with no hand-coded equivalent */}
          <Route path="partners" element={<Navigate to="/admin/contacts" replace />} />
          <Route path="partners/:id" element={<LegacyRedirect model="res.partner" />} />
          <Route path="accounting/invoices" element={<Navigate to="/admin/invoicing/invoices" replace />} />
          <Route path="accounting/invoices/:id" element={<LegacyRedirect model="account.move" />} />
          <Route path="accounting/payments" element={<Navigate to="/admin/invoicing/payments" replace />} />
          {/* hr/leaves and website/products now have hand-coded routes above */}

          {/* 404 catch-all */}
          <Route path="*" element={
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <h1 className="text-4xl font-bold text-foreground mb-2">404</h1>
              <p className="text-muted-foreground mb-4">Page not found</p>
              <a href="/admin/dashboard" className="text-primary hover:underline text-sm">Go to Dashboard</a>
            </div>
          } />
        </Route>
      </Routes>
    </Suspense>
  )
}
