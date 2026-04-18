---
title: Broken internal navigation destinations
severity: high
area: routing
status: resolved
---

## Resolution

Applied 2026-04-18. All 8 broken call sites fixed; typecheck + build pass.

- **Pattern 1** (`AccountingDashboard.tsx:319,336`) — journal title click + "more" button now navigate to `/admin/accounting/entries?journal=${id}` (filter by journal on entries list).
- **Pattern 2** (`AccountingDashboard.tsx:302`, `JournalList.tsx:515,539`) — "New Entry" / "New Cash Move" primary actions now go to `/admin/model/account.move/new?journal_id=${id}` (engine create route), matching the existing pattern at `JournalList.tsx:531`.
- **Pattern 3** (`MrpDashboard.tsx:272-278`) — `newPath` changed to `/admin/repairs/new`, `listBase` changed to `/admin/repairs`. `?picking_type_id=` query remains on deep links; Repairs page will ignore it (acceptable regression per report).
- **Pattern 4** (`MrpDashboard.tsx:301`) — "more" button now navigates to `/admin/model/stock.picking.type/${type.id}` (engine generic route).
- **Pattern 5** (`InventoryDashboard.tsx:282`) — "more" button now navigates to `/admin/model/stock.picking.type/${type.id}`.
- **Pattern 6** (`SpreadsheetList.tsx:66`) — `onRowClick` now navigates to `/admin/model/documents.document/${row.id}` (engine generic route).
- **Pattern 7** (`ProductEditor.tsx:1266`) — "View on Website" now opens `/shop/${productTmplId}` (matches `/shop/:slug` public route).

### Additional change

- `JournalEntries.tsx` updated to read `?journal=` from URL via `useSearchParams()` and apply it as a `['journal_id', '=', id]` domain filter, so Pattern 1 navigation pre-filters the entries list.

### Verification

- `npx tsc --noEmit` in `app/frontend` — exit 0.
- `npx vite build` in `app/frontend` — exit 0, no warnings.
- Re-grep confirmed no remaining literal nav targets for the seven broken patterns. (One non-nav match remains: `erpClient.raw.get('/inventory/picking-types')` in `WarehouseConfig.tsx:50` — an API call, not a route.)


## Summary
- Total internal nav destinations found (literal + template-literal call sites): ~210
- Broken (no matching route): 8 distinct call sites across 5 broken patterns
- All routes defined: 148 routes in `App.tsx` (including redirects and catch-all)

## Broken destinations

Grouped by destination pattern.

### 1. `/admin/accounting/journals/:id` — no such route
Route defined is `accounting/journals` only (the `JournalList` page). There is no detail route.

- `c:/xampp/htdocs/mashora/app/frontend/src/pages/accounting/AccountingDashboard.tsx:319` — `onNavigate(\`/admin/accounting/journals/${journal.id}\`)` — JournalCard title click on accounting dashboard.
- `c:/xampp/htdocs/mashora/app/frontend/src/pages/accounting/AccountingDashboard.tsx:336` — `onNavigate(\`/admin/accounting/journals/${journal.id}\`)` — JournalCard "more" button.

### 2. `/admin/accounting/entries/new` — no such route
Route defined is `accounting/entries` only (the `JournalEntries` page). No `:id`/`new` segment.

- `c:/xampp/htdocs/mashora/app/frontend/src/pages/accounting/JournalList.tsx:515` — `navigate(\`/admin/accounting/entries/new?journal=${journal.id}\`)` — "New Entry" primary action on general-type journal card.
- `c:/xampp/htdocs/mashora/app/frontend/src/pages/accounting/JournalList.tsx:539` — `navigate(\`/admin/accounting/entries/new?journal=${journal.id}\`)` — second "New Entry" CTA (miscellaneous/other journals).
- `c:/xampp/htdocs/mashora/app/frontend/src/pages/accounting/AccountingDashboard.tsx:302` — `primaryAction = { ..., path: \`/admin/accounting/entries/new?journal=${journal.id}\` }` (then `onNavigate(primaryAction.path)` at line 373) — default primary action for non-sale/purchase/bank journal cards.

### 3. `/admin/manufacturing/repair*` — entire subtree missing
`MrpDashboard.tsx` branches on `type.code === 'repair_operation'` to use `/admin/manufacturing/repair` and `/admin/manufacturing/repair/new`, but no such routes exist under the Manufacturing module. (There is a separate top-level `/admin/repairs` / `/admin/repairs/new`.)

- `c:/xampp/htdocs/mashora/app/frontend/src/pages/manufacturing/MrpDashboard.tsx:273` — `'/admin/manufacturing/repair/new'` — `newPath` for repair operation picking-type cards (Plus button).
- `c:/xampp/htdocs/mashora/app/frontend/src/pages/manufacturing/MrpDashboard.tsx:278` — `listBase = '/admin/manufacturing/repair'` — used at lines 291, 314, 320, 327 for title click, Ready/Waiting/Late metric rows.

### 4. `/manufacturing/picking-types/:id` — missing `/admin/` prefix AND route not defined
Bare `/manufacturing/...` does not match `/admin` subtree, and no top-level `/manufacturing` route exists — falls through to the `*` 404 or the website `WebsiteLayout`.

- `c:/xampp/htdocs/mashora/app/frontend/src/pages/manufacturing/MrpDashboard.tsx:301` — `onNavigate(\`/manufacturing/picking-types/${type.id}\`)` — "more" button on manufacturing picking-type card.

### 5. `/admin/inventory/picking-types/:id` — no such route
There is `/admin/inventory/transfers` etc., but no picking-types detail route.

- `c:/xampp/htdocs/mashora/app/frontend/src/pages/inventory/InventoryDashboard.tsx:282` — `onNavigate(\`/admin/inventory/picking-types/${type.id}\`)` — "more" button on inventory picking-type card.

### 6. `/admin/spreadsheets/:id` — no such route
Route defined is only `spreadsheets` (the `SpreadsheetList`). No detail route exists.

- `c:/xampp/htdocs/mashora/app/frontend/src/pages/dashboards/SpreadsheetList.tsx:66` — `onRowClick={(row) => navigate(\`/admin/spreadsheets/${row.id}\`)}` — opening a spreadsheet from the list.

### 7. `/shop/product/:id` — extra path segment
Public route is `/shop/:slug` (single segment). `/shop/product/${productTmplId}` is two segments and does not match.

- `c:/xampp/htdocs/mashora/app/frontend/src/pages/website/ProductEditor.tsx:1266` — `window.open(\`/shop/product/${productTmplId}\`, '_blank')` — "View on Website" SmartButton (only enabled when product is `website_published`; may be user-visible).

## Suggested fixes

### Pattern 1 — `/admin/accounting/journals/:id`
**Redirect route** (fastest, reuses existing infra): add
`<Route path="accounting/journals/:id" element={<LegacyRedirect model="account.journal" />} />`
so clicking a journal drops into the generic model form. Alternatively, **change call sites** in `AccountingDashboard.tsx` to link to `/admin/accounting/entries?journal=${id}` (which lines 285/289 already use as the "draft entries" filter URL).

### Pattern 2 — `/admin/accounting/entries/new`
**Add route** (cleanest): `<Route path="accounting/entries/new" element={<JournalEntries />} />` and have the component read `?journal=` and open a creation modal. Or **redirect route** to the generic engine: `<Route path="accounting/entries/new" element={<Navigate to="/admin/model/account.move/new" replace />} />`. Or **change call site**: update the three call sites to point at `/admin/model/account.move/new?journal_id=${journal.id}` (JournalList.tsx:531 already uses this `model/account.move` pattern, confirming the engine supports it).

### Pattern 3 — `/admin/manufacturing/repair*`
Manufacturing has no repair sub-page; repairs live at `/admin/repairs`. **Change call site**: in `MrpDashboard.tsx:272-278`, rewrite `newPath` to `/admin/repairs/new` and `listBase` to `/admin/repairs`. (Note: the repair picking-type filter `?picking_type_id=` would be ignored by the purpose-built `Repairs` page — a small regression to accept separately.)

### Pattern 4 — `/manufacturing/picking-types/:id`
The "more" button is informational. **Change call site** to `/admin/model/stock.picking.type/${type.id}` (consistent with the accounting "more" button's intent). Or simply remove the button. Prefixing with `/admin/` alone is still broken because there is no `inventory/picking-types` route either (see Pattern 5).

### Pattern 5 — `/admin/inventory/picking-types/:id`
Same fix as Pattern 4: **change call site** to `/admin/model/stock.picking.type/${type.id}`. (The generic `model/:model/:id` engine route handles this.)

### Pattern 6 — `/admin/spreadsheets/:id`
No detail component exists for spreadsheets. Options:
- **Change call site**: remove the `onRowClick` from `SpreadsheetList.tsx` until a detail page is built; or
- **Add route** pointing at the engine: `<Route path="spreadsheets/:id" element={<Navigate to="/admin/model/documents.document/:id" replace />} />` (needs `useParams` helper — reuse the `LegacyRedirect` pattern in App.tsx), so the generic form opens.

### Pattern 7 — `/shop/product/:id`
**Change call site** in `ProductEditor.tsx:1266` to `/shop/${productTmplId}` (the existing `ShopProduct` page at `/shop/:slug`). Alternatively **add route**: `<Route path="/shop/product/:slug" element={<ShopProduct />} />` inside the public website block if a distinct URL is desired for SEO.

## Dead / under-used routes (low-priority observations)

These routes are defined in `App.tsx` but no call site was found navigating to them (users can still reach them via sidebar, bookmark, or engine actions; flagged only for awareness):

- `/admin/sales/subscription-templates` and `/admin/sales/subscription-templates/:id` — defined but no `navigate` / `Link` references found.
- `/admin/sales/products` — duplicate of product-catalog, no direct call site.
- `/admin/inventory/locations`, `/admin/inventory/valuation`, `/admin/inventory/batch`, `/admin/inventory/products` — no call sites found (may be sidebar-only).
- `/admin/hr/jobs`, `/admin/hr/leave-types`, `/admin/hr/org-chart`, `/admin/hr/skills`, `/admin/hr/work-entries`, `/admin/hr/homeworking` — HR dashboard lists them in quickActions data but they are navigated via `navigate(item.path)` at dashboard render time, so these are live. OK.
- `/admin/manufacturing/workcenters`, `/admin/manufacturing/workorders`, `/admin/manufacturing/workorders/:id`, `/admin/manufacturing/bom`, `/admin/manufacturing/bom/:id`, `/admin/manufacturing/subcontracting` — only BomDetail "back" and BundleList deep-link reference them; no dashboard quick-action linking to workcenters/subcontracting.
- `/admin/website/menus`, `/admin/website/courses`, `/admin/website/forum`, `/admin/website/analytics` — only exposed via WebsiteDashboard action cards.
- `/admin/pos/restaurant`, `/admin/pos/terminal/:configId` — only reached from PosRestaurant (restaurant reached nowhere in code except `PosRestaurant` itself navigating to `terminal`).
- `/admin/reports`, `/admin/daily-activity`, `/admin/dashboards` — listed as routes, no in-app `navigate()` references found (sidebar only).
- `/admin/action/:actionId/*` — used internally by `ActionRouter`; not directly navigated to.

## Singular/plural or model-name inconsistencies

- `/admin/repairs` (admin top-level) vs `/admin/manufacturing/repair` (attempted by MrpDashboard, broken). Consolidating on `/admin/repairs` everywhere is recommended.
- `/admin/accounting/entries` (list), `/admin/accounting/entries/new` (broken) vs `/admin/model/account.move/...` (used at JournalList.tsx:531 and in legacy redirect for `accounting/invoices/:id`). Inconsistent — list uses purpose-built page, create uses generic engine. Fine if the purpose-built list grows a `/new` page.
- `/admin/invoicing/invoices` (purpose-built) vs `/admin/accounting/invoices` (redirect) — both exist and the redirect works. OK.
- `/admin/partners` (redirect to `/admin/contacts`) and `/admin/partners/:id` (redirect) — OK.
- No singular/plural mismatches detected between `/sales/order/:id` vs `/sales/orders/:id` — everything consistently uses plural.

## Defined routes reference

Public:
- `/login`
- `/` (Home), `/shop`, `/shop/:slug`, `/blog`, `/blog/:slug`, `/contactus`

Admin (all prefixed with `/admin/`):
- `dashboard`, `sales`, `accounting`, `purchase`, `inventory`, `crm`, `hr`, `projects`, `website`
- `settings`, `settings/general`, `settings/users`, `settings/users/:id`, `settings/companies`, `settings/groups`, `settings/groups/:id`, `settings/access-rights`, `settings/record-rules`, `settings/integrations/google`, `settings/integrations/microsoft`, `settings/integrations/stripe`, `settings/integrations/sms`
- `activities`
- `contacts`, `contacts/tags`, `contacts/:id`
- `products`, `products/list`, `products/categories`, `products/pricelists`, `products/pricelists/:id`, `products/variants`, `products/bundles`, `products/new`, `products/:id`
- `crm/pipeline`, `crm/leads`, `crm/leads/:id`, `crm/activities`, `crm/stages`, `crm/lost-reasons`
- `sales/orders`, `sales/orders/:id`, `sales/orders/:id/margin`, `sales/loyalty`, `sales/loyalty/:id`, `sales/teams`, `sales/commission`, `sales/products`, `sales/subscriptions`, `sales/subscriptions/:id`, `sales/subscription-templates`, `sales/subscription-templates/:id`
- `purchase/orders`, `purchase/orders/:id`
- `invoicing/invoices`, `invoicing/invoices/:id`, `invoicing/payments`
- `accounting/accounts`, `accounting/journals`, `accounting/entries`, `accounting/bank`, `accounting/taxes`, `accounting/reports/trial-balance`, `accounting/reports/profit-loss`, `accounting/reports/balance-sheet`, `accounting/reports/aged-receivable`, `accounting/reports/aged-payable`, `accounting/bank/:id/reconcile`
- `inventory/transfers`, `inventory/transfers/:id`, `inventory/stock`, `inventory/receipts` (Redirect), `inventory/deliveries` (Redirect), `inventory/internal` (Redirect), `inventory/lots`, `inventory/lots/:id`, `inventory/scrap`, `inventory/adjustments`, `inventory/warehouses`, `inventory/locations`, `inventory/replenishment`, `inventory/products`, `inventory/valuation`, `inventory/batch`
- `projects/list`, `projects/tasks`, `projects/tasks/:id`, `projects/:id`, `projects/timesheets`, `projects/timesheets/summary`, `projects/milestones`, `projects/updates`, `projects/stages`, `projects/billing`, `projects/todos`
- `hr/employees`, `hr/employees/:id`, `hr/departments`, `hr/attendance`, `hr/leaves`, `hr/leaves/:id`, `hr/allocations`, `hr/allocations/:id`, `hr/expenses`, `hr/expenses/:id`, `hr/expense-sheets`, `hr/expense-sheets/:id`, `hr/jobs`, `hr/leave-types`, `hr/org-chart`, `hr/skills`, `hr/work-entries`, `hr/homeworking`, `hr/contracts`, `hr/contracts/:id`, `hr/payslip-batches`, `hr/payslip-batches/:id`, `hr/payslips`, `hr/payslips/:id`, `hr/recruitment`, `hr/recruitment/:id`
- `calendar`, `website/pages`, `website/menus`, `website/categories`, `website/blog`, `website/blog/:id`, `website/orders`, `website/products`, `website/products/:id`, `website/analytics`, `website/courses`, `website/forum`, `discuss`
- `fleet`, `fleet/:id`, `fleet/:id/costs`, `fleet/contracts`, `fleet/contracts/:id`, `fleet/odometer`, `fleet/odometer/:id`, `fleet/assignations`, `fleet/assignations/:id`
- `repairs`, `repairs/new`, `repairs/:id`
- `maintenance`, `maintenance/equipment`, `maintenance/calendar`, `maintenance/:id`
- `manufacturing`, `manufacturing/orders`, `manufacturing/orders/:id`, `manufacturing/bom`, `manufacturing/bom/:id`, `manufacturing/workcenters`, `manufacturing/workorders`, `manufacturing/workorders/:id`, `manufacturing/subcontracting`
- `events`, `events/new`, `events/:id`, `events/:id/edit`, `events/:id/registrations`, `events/:id/tracks`
- `surveys`, `surveys/:id`, `surveys/:id/responses`
- `email-marketing`, `email-marketing/:id`, `email-marketing/lists`, `email-marketing/templates`
- `pos`, `pos/sessions`, `pos/sessions/:id`, `pos/orders`, `pos/orders/:id`, `pos/config`, `pos/terminal/:configId`, `pos/restaurant`
- `dashboards`, `dashboards/:id`, `daily-activity`, `spreadsheets`, `reports`
- `action/:actionId/*`, `model/:model`, `model/:model/:id`
- Legacy redirects: `partners` -> `contacts`, `partners/:id` (LegacyRedirect), `accounting/invoices` -> `invoicing/invoices`, `accounting/invoices/:id` (LegacyRedirect), `accounting/payments` -> `invoicing/payments`
- `*` 404 catch-all (404 page)
