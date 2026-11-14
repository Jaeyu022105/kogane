# Kogane Resource Order & Directory Organization Standards

This document defines project-wide standards for organizing directories, modules, Vue components, Nitro server routes, localization dictionaries, and automated tests across the **Kogane** repository.

---

## 1. Core Objectives

1. **Deterministic Project Structure**: Keep files placed in their canonical Nuxt 3 / Nitro directories so changes produce predictable, easily reviewable git diffs.
2. **Strict Layer Boundaries**: Separate pure isomorphic domain logic (`lib/`), reactive client state (`composables/`), reusable UI components (`components/`), routed views (`pages/`), and server-only persistence/API handlers (`server/`).
3. **Cross-Resource Parity**: Keep paired resources—such as the 6 locale dictionaries (`locales/*.json`), element renderers (`components/elements/*El.vue`), and test suites (`tests/*.test.ts`)—synchronized and alphabetically organized.

---

## 2. Root Directory Hierarchy

Top-level directories and root configuration files in Kogane follow this canonical structure:

```text
kogane/
├── .agents/
│   └── rules/                  # Architectural, style, review, resource-order & workflow rules
├── assets/
│   └── css/
│       ├── marketing.css       # Neapolitan marketing design tokens, typography & .ribbon CTAs
│       └── tailwind.css        # Shell tokens, dashboard cards, .btn-primary & .btn-ribbon
├── components/
│   ├── elements/               # Canvas widget primitives (*El.vue)
│   └── *.vue                   # Shared dashboard, builder, onboarding & marketing components
├── composables/                # Vue 3 Composition API state & runtime hooks (use*.ts)
├── layouts/                    # Nuxt page layouts (default.vue, dashboard.vue, marketing.vue)
├── lib/                        # Pure domain logic, types, presets & database/storage adapters
├── locales/                    # 6-locale JSON dictionaries (en, es, ja, ko, ph, zh)
├── pages/                      # File-based Nuxt routes (marketing, dashboard/*, terminal/*, t/*)
├── public/                     # Static assets (favicon.svg, apple-touch-icon.png, og-image.png, manifest)
├── scripts/                    # CLI maintenance, DB seed/reset/backup & launcher scripts
├── server/
│   ├── api/                    # Nitro REST API endpoints grouped by domain
│   ├── middleware/             # Security & SEO HTTP response header middleware
│   ├── routes/                 # Root crawler routes (llms.txt, robots.txt, sitemap.xml)
│   └── utils/                  # Server-only business, audit, preset sync & reporting helpers
├── supabase/
│   └── schema.sql              # Reference PostgreSQL schema for Supabase deployments
├── tests/                      # Bun unit, integration, security & SEO test suites (*.test.ts)
├── AGENTS.md                   # Primary Developer & Agent Guide
├── CLAUDE.md                   # Dedicated Claude Agent Guide
├── GEMINI.md                   # Dedicated Gemini / Antigravity Agent Guide
├── DESIGN-DOCUMENT.md          # Product design specification & domain workflows
├── DEPLOYMENT.md               # SQLite, Supabase & Firebase deployment guide
├── HANDOFF.md                  # Historical engineering log
├── nuxt.config.ts              # Nuxt 3 & Nitro configuration
├── tailwind.config.ts          # Tailwind CSS theme & Neapolitan color extensions
└── package.json                # Bun scripts & dependency manifest
```

---

## 3. Directory & Module Organization Rules

### A. `lib/` — Isomorphic Domain Logic & Adapters

Modules in `lib/` contain TypeScript types, pure domain functions, and provider adapters. Keep files ordered alphabetically on disk and grouped conceptually by domain:

1. **Core Types & Presets**:
   - `lib/uiTypes.ts` — Authoritative schema for `UILayout`, `UIElement`, `UITheme`, `UIEventBinding`, and layout bundles.
   - `lib/builderPresets.ts` — Starter role-based terminal layouts (`cashier-register`, `kitchen-display`, `inventory-manager`, `catalog-registrar`, `reports-viewer`).
   - `lib/starterWorkstations.ts` — Industry workstation variants and preset catalog metadata.
   - `lib/stationObjects.ts` — Composite workstation widgets for the UI Builder.
   - `lib/workspaceBranding.ts` — Brand color extraction, layout bundle theming, and surface styling.
2. **Database & Storage Adapters**:
   - `lib/db.ts` — `DatabaseAdapter` contract and active provider factory (`getDb()`).
   - `lib/db-sqlite.ts`, `lib/db-supabase.ts`, `lib/db-firebase.ts` — Concrete database implementations.
   - `lib/firebaseAdmin.ts` — Lazy-initialized Firebase Admin SDK singleton.
   - `lib/storage.ts` — Multi-provider file and inline asset storage adapter.
3. **Security, Permissions & SQL Safety**:
   - `lib/permissions.ts` — Role permission presets (`ALL_TERMINAL_PERMISSION_PRESETS`) and lookup helpers (`presetByRoleOrKey`).
   - `lib/authUtils.ts` — Session signing, password hashing, and TOTP 2FA utilities.
   - `lib/sql.ts` — SQL identifier validation (`validateIdentifier`) and query helpers.
   - `lib/security.ts` & `lib/securityClient.ts` — XSS sanitization and payload size validation.
   - `lib/rateLimit.ts` — Request rate limiting per IP/route.
   - `lib/audit.ts` — Audit log formatting and safe JSON parsing (`parseAuditJson`).
4. **Operational Calculations & Runtime**:
   - `lib/runtime.ts` — Template interpolation (`{{field}}`) and event payload resolution.
   - `lib/currency.ts`, `lib/discounts.ts`, `lib/kitchenDisplay.ts`, `lib/reportDiagrams.ts`, `lib/schemaUtils.ts`, `lib/mappers.ts`.

### B. `composables/` — Reactive Client Orchestration

Every composable in `composables/` must be named `use<Domain>.ts` in `camelCase` and export its primary composable function:

- `useAuth.ts`, `useBusiness.ts`, `useCanvas.ts`, `useCanvasRuntime.ts`, `useCurrency.ts`, `useEnterpriseAccess.ts`, `useEventQueue.ts`, `useLocale.ts`, `useModal.ts`, `useOnboarding.ts`, `useRealtimeSync.ts`, `useSchema.ts`, `useSeo.ts`, `useShareOrigin.ts`.

### C. `components/` — Reusable UI & Canvas Elements

- **Top-Level Components (`components/*.vue`)**: Named in `PascalCase` (`Canvas.vue`, `ElementRenderer.vue`, `EmptyState.vue`, `HomeExplorerPosPanel.vue`, `HomeHeroCollage.vue`, `HomePresetExplorer.vue`, `ModalHost.vue`, `OnboardingModal.vue`, `PageHeader.vue`, `PropertiesPanel.vue`, `SalesDiagrams.vue`, `Spinner.vue`, `TerminalCard.vue`, `TerminalThumbnail.vue`).
- **Canvas Element Primitives (`components/elements/*El.vue`)**: Every canvas widget component must reside in `components/elements/` and end with the `El.vue` suffix (`ButtonEl.vue`, `CartWidgetEl.vue`, `ChartEl.vue`, `ImageEl.vue`, `InputFieldEl.vue`, `ScanFieldEl.vue`, `TableViewEl.vue`, `TextEl.vue`, `UploadEl.vue`).

### D. `pages/` — Nuxt File-Based Routing

- **Public Marketing & Legal Pages (`pages/*.vue`)**: `index.vue`, `features.vue`, `pricing.vue`, `login.vue`, `signup.vue`, `privacy.vue`, `terms.vue`.
- **Admin Dashboard Pages (`pages/dashboard/**`)**: `index.vue`, `builder.vue`, `database.vue`, `audit.vue`, `reports.vue`, `settings.vue`, `terminals/index.vue`, `terminals/[id].vue`.
- **Staff Terminal Runtime Pages**: `pages/terminal/[id].vue` (authenticated/PIN workstation) and `pages/t/[slug].vue` (public share link workstation).

### E. `server/` — Nitro Backend

- **`server/middleware/`**: `security.ts` and `seoHeaders.ts`.
- **`server/routes/`**: Root discovery endpoints (`llms.txt.ts`, `robots.txt.ts`, `sitemap.xml.ts`).
- **`server/utils/`**: Server-only domain helpers (`audit.ts`, `business.ts`, `businessTable.ts`, `managedTerminals.ts`, `realtimeHub.ts`, `reporting.ts`, `salesMetrics.ts`, `spreadsheet.ts`, `starterTables.ts`, `storageServe.ts`, `taxFiling.ts`).
- **`server/api/`**: Grouped by resource domain (`auth/`, `businesses/`, `data/`, `presets/`, `realtime/`, `reports/`, `runtime/`, `schema/`, `storage/`, `terminals/`, plus `audit-log.get.ts`) with explicit HTTP method suffixes (`.get.ts`, `.post.ts`, `.patch.ts`, `.delete.ts`).

### F. `locales/` — 6-Locale Dictionary Ordering

All 6 locale files (`locales/en.json`, `locales/es.json`, `locales/ja.json`, `locales/ko.json`, `locales/ph.json`, `locales/zh.json`) must maintain **identical top-level section ordering and key parity**. `locales/en.json` is the canonical key reference.

---

## 4. Resource Integrity & Registration Checklist

Whenever adding or updating a resource in Kogane, complete the matching registration steps:

1. **Adding a New Canvas Element Type**:
   - Register the element type and props interface in `lib/uiTypes.ts`.
   - Create `components/elements/<Name>El.vue` and wire it into `components/ElementRenderer.vue` and `components/PropertiesPanel.vue`.
2. **Adding or Updating a Workstation Preset**:
   - Register the preset layout in `lib/builderPresets.ts` / `lib/starterWorkstations.ts`.
   - Ensure its default role permissions are registered in `lib/permissions.ts` (`ALL_TERMINAL_PERMISSION_PRESETS` and `presetByRoleOrKey`).
   - Verify `server/utils/managedTerminals.ts` and `POST /api/presets/sync` propagate updates cleanly to terminals using that `managed_preset_key`.
3. **Adding a New Page or Route**:
   - Add `usePageSeo()` in the page script.
   - If the route ispublic and indexable, register it in `server/routes/sitemap.xml.ts`. If it is private/authenticated, ensure its prefix is covered by `NOINDEX_PREFIXES` in `server/middleware/seoHeaders.ts` and `Disallowed` in `server/routes/robots.txt.ts`.
4. **Adding User-Facing Copy**:
   - Add the translation key to all 6 files in `locales/{en,es,ja,ko,ph,zh}.json`.
5. **Verification**:
   - Run `bun test`, `bunx nuxi typecheck`, and `bun run build` before committing.
