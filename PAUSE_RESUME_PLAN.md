# Kogane — Production Pause & Resume State Plan

This document contains the complete state snapshot, implemented features, security & anti-exploit audit, and resumption steps for Kogane.

---

## 1. Executive Summary & Accomplishments

### A. E-Commerce Elements Completely Stripped
- **Onboarding Modal (`components/OnboardingModal.vue`)**:
  - Removed online orders and fulfilment presets.
  - Retail setup is strictly focused on in-person counter workstations (`shop` and `boutique`).
  - Delivery feature removed from retail so it cannot be used for online e-commerce parcel shipping.
- **Workstation Presets (`lib/builderPresets.ts`)**:
  - Eliminated legacy unconfigured `pos-screen` (which contained customer checkout buttons) and deprecated empty placeholders.
  - Locked down to 5 official, production-ready operational workstation presets:
    1. `cashier-station` (Counter Cashier Register)
    2. `kitchen-station` (Kitchen Queue & Bumping Display)
    3. `inventory-station` (Stock Room & Inventory Control)
    4. `catalog-station` (Catalog & Product Registrar)
    5. `reports-station` (Operations & Audit Reports)
- **Terminology & Actions Cleaned Up (`lib/starterWorkstations.ts`, `lib/stationObjects.ts`)**:
  - Replaced all customer "checkout" wording with "Cashier Register" and "Manual Order Intake".

### B. Continuous Real-Time Synchronization Engine
- **In-Memory Pub/Sub Hub (`server/utils/realtimeHub.ts`)**:
  - Scoped strictly by `business_id` (zero cross-tenant data leakage).
  - Handles table-level mutations: `insert`, `update`, `delete`.
- **Native Server-Sent Events Endpoint (`server/api/realtime/stream.get.ts`)**:
  - Supports streaming updates without external dependencies.
  - Resolves business context safely via validated query params (`businessId`, `terminalId`, or public `slug`).
  - Automatic 20s heartbeat pings keep connections alive through reverse proxies and LAN firewalls.
- **Client Synchronization Composable (`composables/useRealtimeSync.ts`)**:
  - Auto-reconnect with exponential backoff.
  - Transparent support for native SSE or Supabase Realtime channels.
- **Live UI Binding (`composables/useCanvasRuntime.ts`, `TableViewEl.vue`, `CartWidgetEl.vue`)**:
  - Automatically re-fetches and updates tables (order queues, stock levels) upon receiving mutation events.
  - **Kitchen Bumping**: Staff can tap order status pills (`PENDING` -> `PREPARING` -> `FULFILLED`) which immediately broadcasts to Cashier screens and manager dashboards without page refreshes.

### C. Production Deployability Assets
- **`Dockerfile`**: Multi-stage production container based on `oven/bun:1-alpine`, non-root security context, built-in health check.
- **`docker-compose.yml`**: 1-command deployment with volume persistence for SQLite.
- **`supabase/schema.sql`**: Complete PostgreSQL schema, RPC functions (`execute_query`, `execute_ddl`), indexes, and RLS rules.
- **`DEPLOYMENT.md`**: Step-by-step guides for Docker, Supabase Cloud, and LAN multi-device operations.

### D. Exportable Excel Files & Data Intelligence
- **Spreadsheet Generation Engine (`server/utils/spreadsheet.ts`)**:
  - Pure zero-dependency OpenXML (.xlsx PKZIP), Microsoft XML Spreadsheet (.xls), and CSV generation built with TypeScript and `node:zlib`.
  - Full multi-sheet support, custom styling, colors, borders, column widths, number formatting (currency `$#,##0.00`, percentages `0.0%`, integers, timestamps), and formulas (`=SUM(...)`, `=AVERAGE(...)`).
  - **DDE/CSV Formula Injection Hardening**: All user-controlled text strings starting with `=`, `+`, `-`, `@`, `\t`, `\r` are neutralized with single-quote escaping to prevent external code execution.
- **Sales & Performance Metrics Engine (`server/utils/salesMetrics.ts`, `server/api/reports/sales-metrics.get.ts`, `server/api/reports/export/sales.get.ts`)**:
  - Detailed transactions breakdown, gross revenue, order volume, and average order value (AOV).
  - Time-series trend aggregations and moving averages (3-day and 7-day Simple Moving Average).
  - Run-rate tracking: daily run rate, 30-day projected run rate, annualized 365-day run rate.
  - Predictive forecasting: linear regression trajectory slope ($/day drift), trend classification (`growing`, `stable`, `declining`), next 7d, 14d, and 30d projected sales with confidence intervals.
  - Product demand forecasting: daily velocity per item and projected 7-day / 30-day unit demand to streamline restocking.
- **Tax Filing & Compliance Engine (`server/utils/taxFiling.ts`, `server/api/reports/tax-summary.get.ts`, `server/api/reports/export/tax.get.ts`)**:
  - Specialized 4-sheet tax workbook:
    1. *Tax Filing Summary*: Executive return schedule (Gross sales, exempt/zero-rated goods, net taxable sales, tax collected, net sales retained).
    2. *Periodic Tax Ledger*: Daily tax activity schedule with formula totals.
    3. *1099-K Settlement Reconciliation*: Critical breakdown of Cash vs Card vs QR/Digital receipts for merchant tax audits.
    4. *Line Item Tax Audit*: Granular line-item audit trail with tax rates, tax amounts, and receipt references.
- **Reports Station UI Integration (`pages/dashboard/reports.vue`)**:
  - Interactive tabs for Sales Transactions, Performance & Forecasts, and Tax Filing Schedule.
  - Visual KPI cards, regression projection panels, restock demand tables, and tax schedules.
  - 1-click downloads for "Export Sales & Forecasts (.xlsx)", "Export Tax Filing (.xlsx)", and CSV.

---

## 2. Security & Anti-Exploit Review ("No Loopholes")

| Attack Vector / Risk | Mitigation Implemented | File Reference |
| :--- | :--- | :--- |
| **SQL Injection** | Dynamic SQL uses parameterized queries (`?` for SQLite, `$1` for Postgres) with positional binding. Identifiers (table & column names) are strictly validated via regex `^[a-zA-Z_][a-zA-Z0-9_]*$`. | `lib/schemaUtils.ts`, `server/api/data/query.post.ts`, `server/utils/salesMetrics.ts` |
| **Cross-Tenant Data Leakage** | All database queries, export endpoints, and real-time broadcasts are strictly isolated by `business_id` and isolated tenant table schemas. Realtime pub/sub topics are scoped per business. | `server/utils/realtimeHub.ts`, `server/api/runtime/event.post.ts`, `server/api/reports/export/*` |
| **Spreadsheet / CSV Formula Injection** | Cells starting with `@`, `=`, `+`, `-`, `\t`, `\r` are neutralized with single quotes to prevent remote code execution / DDE exploits in Microsoft Excel / LibreOffice. | `server/utils/spreadsheet.ts` |
| **Unauthorized Terminal Mutations** | Runtime actions validate against fine-grained permission sets in `lib/permissions.ts`. Staff terminals cannot mutate tables outside their allowed grant. | `server/api/runtime/event.post.ts`, `lib/permissions.ts` |
| **Public Terminal Exploitation** | Public shared terminals (`/t/[slug]`) receive scoped runtime sessions that only allow actions configured for that terminal preset. Unauthorized attempts are rejected and logged. | `lib/authUtils.ts`, `server/api/runtime/event.post.ts` |
| **Audit Log Tampering** | Audit log writes are handled internally by server utilities upon mutation; client terminals cannot delete or rewrite audit records. | `server/utils/audit.ts` |
| **Denial of Service (Query Exhaustion)** | Queries enforce strict max pagination limits (capped at 200 rows max per request). | `server/api/data/query.post.ts` |
| **Secret Leakage** | `.env` is ignored by Git and Docker. Secrets template stored safely in `.env.example`. | `.gitignore`, `.dockerignore` |

---

## 3. Verification & Test Status

- **Unit & Integration Tests**: 34/34 tests pass (`bun test`).
  - `tests/presets-ecommerce-removal.test.ts` (5 tests pass)
  - `tests/realtime.test.ts` (3 tests pass)
  - `tests/reporting.test.ts` (3 tests pass)
  - `tests/excel-export.test.ts` (5 tests pass)
  - `tests/sales-tax-reporting.test.ts` (11 tests pass)
  - `tests/api-reports-export.test.ts` (7 tests pass)
- **Production Build**: Verified with `bun run build`.
- **Background Processes**: All background subagents and tasks are paused/stopped cleanly.

---

## 4. Resumption Plan (When you return and run `/boost continue`)

When you reconnect the internet and run `/boost continue`, the remaining polish checklist is:

1. **Verify Git Remote & Push**:
   - Verify local commits and push to `https://github.com/Jaeyu022105/kogane.git` on `main`.
2. **First-Run Demo Seeding (Optional UX Enhancement)**:
   - Provide an optional button or starter seed (e.g. 4 sample items and 2 sample orders) so new business onboarding immediately displays data on screens without manual catalog typing.
3. **Hardened Production Launch**:
   - Run `docker compose up -d --build` or deploy directly to your hosting server using `DEPLOYMENT.md`.
