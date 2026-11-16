# Kogane Architecture & Platform Systems

This document outlines the core product architecture, managed preset propagation engine, tri-provider database abstraction, canvas UI builder, terminal runtime, realtime synchronization hub, role-based access control, and SEO/localization pipeline of **Kogane**.

---

## 1. Product Overview

**Kogane** is a lightweight, preset-driven SaaS Terminal Builder for small and medium businesses built with **Nuxt 3**, **Vue 3**, **TypeScript**, **Tailwind CSS**, and **Bun / Nitro**. Instead of building expensive custom internal apps or wrestling with raw database consoles, business owners select pre-configured terminal presets, apply their brand aesthetic, and deploy staff-ready workstations where **1 platform improvement updates every connected terminal automatically**.

### The Managed Terminal Lifecycle

1. **Workspace Onboarding (`components/OnboardingModal.vue`, `POST /api/businesses/onboard`)**:
   - The business owner configures their workspace: business name, industry type, logo, preferred locale (`en`, `ph`, `es`, `ja`, `ko`, `zh`), feature preset, layout bundle (`Aurora Service`, `Ink Studio`, `Paper Ledger`), terminal layout variants, element shape style (`rounded` or `square`), and ambient effect (`none`, `orbs`, or `grid`).
   - Onboarding atomically provisions starter business tables (`products`, `orders`, `inventory` via `server/utils/starterTables.ts`) and branded starter terminals (`server/utils/managedTerminals.ts`).
2. **Preset Selection & UI Customization (`pages/dashboard/builder.vue`, `lib/builderPresets.ts`)**:
   - Admins select from role-based and industry workstation presets (`Cashier Register`, `Kitchen Display`, `Inventory Manager`, `Catalog Registrar`, `Reports Viewer`, plus industry workstation templates in `lib/starterWorkstations.ts` and `lib/stationObjects.ts`).
   - Layouts are edited on an interactive canvas (`components/Canvas.vue`, `components/PropertiesPanel.vue`) using typed `UIElement` primitives (`lib/uiTypes.ts`).
3. **Managed Preset Propagation (1 Improvement Updates Every Terminal)**:
   - Terminals created from a preset record their upstream `managed_preset_key` (`server/utils/managedTerminals.ts`).
   - When a preset layout is improved or updated (`POST /api/presets/sync` or `POST /api/presets/apply`), the platform propagates structural layout, element, and workflow upgrades to every connected terminal linked to that preset while preserving business-level branding (`lib/workspaceBranding.ts`).
4. **Staff Terminal Deployment (`pages/terminal/[id].vue`, `pages/t/[slug].vue`)**:
   - Staff launch workstations on tablets, desktops, or phones via private routes (`/terminal/[id]`) or locked public share links (`/t/[slug]`) with optional employee PIN authentication (`/api/terminals/login`).
   - Public share links lock staff into their assigned workstation without exposing admin dashboard navigation.
5. **Runtime Event Execution & Realtime Sync (`composables/useCanvasRuntime.ts`, `POST /api/runtime/event`)**:
   - Terminal interactions (`insertRow`, `updateRow`, `deleteRow`, `navigate`, `openModal`, `printReceipt`, `incrementStock`, and kitchen status transitions `pending -> preparing -> fulfilled -> served`) execute through `useCanvasRuntime.ts` and `lib/runtime.ts`.
   - Mutations are validated against terminal role permissions (`lib/permissions.ts`), persisted via the active database adapter (`lib/db.ts`), and broadcast immediately over Server-Sent Events (`/api/realtime/stream`, `server/utils/realtimeHub.ts`, `composables/useRealtimeSync.ts`) so Kitchen Displays, Cashier Registers, and Inventory Boards update live across devices.
6. **Audit Trail & Operational Reporting (`pages/dashboard/audit.vue`, `pages/dashboard/reports.vue`)**:
   - Every workspace, schema, preset, and terminal action is recorded in `audit_log` (`lib/audit.ts`, `server/utils/audit.ts`).
   - Store managers review real-time sales metrics, PWD/Senior discount logs, tax summaries, and CSV/Excel exports via `server/utils/reporting.ts`, `server/utils/salesMetrics.ts`, `server/utils/taxFiling.ts`, and `server/utils/spreadsheet.ts`.

### Core Safeguards & Invariants

- **Additive UI & Neapolitan Design Preservation**:
  - Preserve Kogane's signature **Neapolitan ice cream palette** (`#68293A` chocolate maroon, `#FF5776` strawberry pink, `#F6E6D7` vanilla cream, `#E3C7B9` blush), `DM Serif Display` headings, `Inter` body text, `JetBrains Mono` (`tabular-nums`) metrics, and hanging `.ribbon` / `.btn-ribbon` bookmark tails on primary buttons.
  - Always extend existing marketing, auth, and dashboard components additively; never strip or replace early-version UI sections unless explicitly requested.
- **Tri-Provider Database Parity**:
  - All data operations route through `db` (`lib/db.ts`), written in SQLite-dialect SQL. Locally it runs on SQLite (`lib/db-sqlite.ts`); in production on Firebase Cloud Firestore (`lib/db-firebase.ts`, which translates the same SQL). `lib/backend.ts` is the only place that decides which one is active; routes never check.
  - Domain logic and API handlers must remain provider-agnostic so local `DEV_MODE=true` SQLite runs and cloud deployments behave identically.
- **Role-Based Permission Enforcement**:
  - Every terminal mutation checks table and action permissions (`select`, `insert`, `update`, `delete`) resolved via `lib/permissions.ts` (`ALL_TERMINAL_PERMISSION_PRESETS` and `presetByRoleOrKey()`).
- **Strict Scope Boundaries**:
  - **No Real Money Transfer**: Payment workflows (`Cash`, `Card`, `GCash`) record transaction metadata, receipt numbers, and payment status logs only; never connect to live bank transfer APIs or charge real payment gateways.
  - **Browser-Native Runtime**: Barcode scanning uses key-press burst analysis (`components/elements/ScanFieldEl.vue`), and receipt printing uses browser print stylesheets without requiring proprietary vendor USB/Bluetooth SDKs.

---

## 2. Architecture & Subsystem Map

### Runtime Configuration & Middleware Pipeline

- `nuxt.config.ts`: Configures Nuxt 3, Tailwind CSS (`assets/css/tailwind.css` + `assets/css/marketing.css`), `runtimeConfig` (`devMode`, `dbProvider`, `storageProvider`, `firebaseSparkMode`, session/encryption secrets, and public SEO/share origins), and Nitro presets (`firebase` vs Node/Bun server).
- `server/middleware/security.ts`: Applies security headers (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, CSP) and request hardening across routes.
- `server/middleware/seoHeaders.ts`: Sets `X-Robots-Tag: noindex, nofollow` on non-public/authenticated routes (`/dashboard`, `/terminal`, `/t/`, `/login`, `/signup`, `/api/`) while keeping public marketing pages indexable.

### Database & Storage Abstraction (`lib/db*.ts`, `lib/storage.ts`)

- `lib/db.ts`: Defines the `DatabaseAdapter` interface and resolves the active singleton adapter based on `DB_PROVIDER` and `DEV_MODE`.
- `lib/db-sqlite.ts`: Local development and test adapter using `bun:sqlite` with parameterized queries and automatic schema initialization.
- `lib/backend.ts`: Local vs production detection (database and upload storage) from `DEV_MODE`, Firebase credentials, and the optional `DB_PROVIDER` / `STORAGE_PROVIDER` overrides.
- `lib/db-firebase.ts`: Cloud Firestore adapter via lazy-loaded `firebase-admin/firestore` (`lib/firebaseAdmin.ts`), supporting Firebase Spark free-tier and Blaze deployments.
- `lib/storage.ts` & `server/utils/storageServe.ts`: Upload storage (`local` disk, Firebase Cloud Storage, and `firestore` inline blobs for `<= 700 KB` Spark-mode assets), chosen by `lib/backend.ts`.
- `lib/sql.ts` & `lib/security.ts`: Identifier allowlisting (`validateIdentifier`), SQL injection prevention, XSS payload sanitization, and payload size guards.

### Preset, Branding & Workstation Engine

- `lib/uiTypes.ts`: Authoritative TypeScript interfaces for `UILayout`, `UIElement`, `UITheme`, `UIEventBinding`, `LayoutBundleKey`, and element-specific properties.
- `lib/builderPresets.ts`: Starter layout definitions for core workstation roles (`cashier-register`, `catalog-registrar`, `inventory-manager`, `kitchen-display`, `reports-viewer`).
- `lib/starterWorkstations.ts`: Multi-variant workstation templates and industry preset definitions (Food & Beverage, Retail & Counter POS, Logistics & Dispatch, Stock Receiving, Appointment & Service Desk).
- `lib/stationObjects.ts`: Higher-level composite workstation objects that drop pre-wired operational widgets onto the builder canvas.
- `lib/workspaceBranding.ts`: Applies business palette tokens, layout bundle themes (`Aurora Service`, `Ink Studio`, `Paper Ledger`), surface roundness, and ambient effects across generated terminals.
- `server/utils/managedTerminals.ts`: Creates branded starter terminals during onboarding and synchronizes upstream preset updates (`POST /api/presets/sync`) to terminals sharing a `managed_preset_key`.
- `server/utils/starterTables.ts`: Provisions and seeds starter business tables (`products`, `orders`, `inventory`).

### Canvas Builder & Terminal Runtime

- `composables/useCanvas.ts`: Manages builder selection, drag/resize geometry, undo/redo history, property mutations, and layout persistence (`PATCH /api/terminals/layout`).
- `composables/useCanvasRuntime.ts` & `lib/runtime.ts`: Executes live terminal workflows, template expression interpolation (`{{row.field}}`, `{{cart.total}}`), cart calculations, PWD/Senior Citizen discounts (`lib/discounts.ts`), currency formatting (`lib/currency.ts`), and kitchen order state transitions (`lib/kitchenDisplay.ts`).
- `composables/useEventQueue.ts`: Serializes and debounces rapid terminal mutations (such as barcode scan bursts or rapid quantity taps).
- `components/Canvas.vue`, `components/ElementRenderer.vue`, `components/PropertiesPanel.vue`: Core builder and runtime rendering shell, delegating element rendering to `components/elements/{ButtonEl,CartWidgetEl,ChartEl,ImageEl,InputFieldEl,ScanFieldEl,TableViewEl,TextEl,UploadEl}.vue`.

### Realtime Synchronization Hub

- `server/utils/realtimeHub.ts` & `server/api/realtime/stream.get.ts`: In-memory pub/sub hub streaming Server-Sent Events (SSE) scoped by `businessId` whenever rows, orders, inventory, or terminal layouts change.
- `composables/useRealtimeSync.ts`: Client-side SSE subscriber with automatic reconnection and fallback polling so multi-device terminals stay synchronized.

### Authentication, Permissions & Audit Logging

- `lib/authUtils.ts` & `composables/useAuth.ts`: Session token signing/verification, password hashing, TOTP 2FA setup/verification (`/api/auth/2fa/*`), backup codes, and active session revocation (`/api/auth/sessions/*`).
- `lib/permissions.ts`: Role-based permission presets (`ALL_TERMINAL_PERMISSION_PRESETS`) and lookup helpers (`presetByRoleOrKey`) governing per-table CRUD access for each terminal.
- `lib/audit.ts` & `server/utils/audit.ts`: Structured audit event recording (`recordAuditLog`) and defensive JSON payload parsing (`parseAuditJson`) rendered in `pages/dashboard/audit.vue`.

### Localization & Public SEO

- `composables/useLocale.ts` & `locales/{en,ph,es,ja,ko,zh}.json`: Reactive 6-locale dictionary lookup with legacy `fil -> ph` normalization (`normalizeLocale`).
- `composables/useSeo.ts` & `server/routes/{robots.txt,sitemap.xml,llms.txt}.ts`: Page-level OpenGraph, Twitter Card, JSON-LD (`SoftwareApplication`, `WebSite`, `FAQPage`), and canonical link generation (automatically omitting `<link rel="canonical">` when `noindex: true`).
