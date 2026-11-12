# Kogane Handoff

This is the living handoff for future AI sessions and future maintainers. Read this file first, then `DESIGN-DOCUMENT.md`, then `README.md`, then inspect only the files needed for the current task.

After every meaningful prompt or implementation pass, update this file with:

- What changed.
- Why it changed.
- Files touched.
- What still needs work.
- Any risks, assumptions, or verification results.

---

## Current Project Identity

**Kogane** is a **preset-driven terminal system** for small and medium businesses. The core value proposition is simple: instead of building or buying custom proprietary software, businesses get free, high-quality, and stable terminal presets that they can customize and deploy immediately.

The project was originally named **Postfolio** (a schema-driven internal tool builder). It was later rebranded and reoriented into Kogane. Old references to Postfolio in code or context may still appear but are historical. All new UI, docs, and copy should use Kogane.

**What Kogane is**:
- A set of free, ready-to-use terminal presets (Cashier, Kitchen Display, Inventory, Catalog, Reports).
- A visual UI builder so admins can customize those presets without writing code.
- A backend that generates the right database tables when a preset is selected.
- A terminal runtime that staff access via PIN-lock or a shareable public link.

**What Kogane is not** (see Exclusions section below).

---

## Exclusions & Explicit Boundaries

These are firm boundaries that should not be crossed or implied in any UI copy, feature, or integration:

- **No real money transfer.** Kogane records payment method metadata (Cash, Card, GCash), receipt numbers, and order totals. It does not connect to bank accounts, execute real payment gateway transactions, or move actual funds. Payment methods shown in the cashier are informational labels for the cashier's reference only.
- **No real card reader connection.** The card reader flow in the cashier terminal is a simulated bridge-ready workflow. A real hardware card reader still requires a vendor-specific SDK or a local bridge process that is not part of this codebase.
- **No native iOS, Android, or desktop app.** Kogane runs in modern web browsers. There are no compiled native packages, no App Store submissions, and no Electron builds.
- **No payment gateway integrations.** Stripe, PayPal, PayMongo, and equivalent services are explicitly out of scope. Do not add payment API keys, webhooks, or live payment flows.
- **No enterprise hardware SDKs.** Barcode/QR scanner support uses browser key-burst emulation. No USB, Bluetooth, or vendor-specific driver integration is included.
- **No paid third-party SaaS lock-in.** Local development runs standalone SQLite via Bun (`DEV_MODE=true`). Online cloud hosting targets **Firebase** (Firebase App Hosting / Hosting + Cloud Functions Gen 2, Cloud Firestore, and Firebase Storage), with Supabase/PostgreSQL kept only as a legacy alternative (`DB_PROVIDER=supabase`). Do not provision unrelated paid infrastructure without explicit instruction.
- **No marketplace or plugin ecosystem.** There is no third-party extension system, plugin store, or external app marketplace.

---

## Context Sources Used

Earlier context folders were reviewed during the initial handoff pass:

- First context: original Postfolio charter.
- Second context: Kogane initiation update.
- Third context: WBS/OBS project management content.
- Fourth context: estimating and budget/schedule context.

Those folders are temporary and can be deleted. The durable project context lives in:

- `DESIGN-DOCUMENT.md`
- `HANDOFF.md`
- `README.md`
- The source code itself

---

## Current App State

Implemented or partially implemented areas:

- Kogane rebrand applied to app identity and package metadata.
- Localization supports `en`, `ph`, `es`, `ja`, `ko`, and `zh`. Legacy `fil` should map to `ph`.
- Marketing pages exist for home, features, pricing, terms, and privacy.
- Login/get-started page supports locale detection and dev-mode auth.
- Onboarding creates a business, provisions feature tables, generates starter terminals, applies layout variants, and sets branding.
- Dashboard includes overview, database, UI builder, terminals, audit log, reports, and settings.
- Terminal management supports create, delete, thumbnails, copy link, copy PIN, options/detail page, public slugs, and terminal layout editing.
- UI Builder supports canvas editing, terminal theme editing, station objects, generic widgets, color customization, layout presets, and layout saves.
- Staff terminals render on private routes (`/terminal/[id]`) and public/shared routes (`/t/[slug]`).
- Cashier supports table number, cart, payment method metadata, simulated card reader, and browser receipt printing.
- Catalog registrar supports product entry and catalog viewing.
- Inventory manager supports stock views, receiving-oriented layouts, upload tools, and charts.
- Kitchen display can view incoming orders with auto-refresh. **Order status mutation is not yet implemented** (see Known Gaps).
- Reports viewer supports audit/activity tables and charts.

---

## Architecture Notes

Main stack:

- Nuxt 3 and Vue 3 (SSR + Nitro server routes, Firebase App Hosting / Cloud Functions Gen 2)
- Bun runtime
- Tailwind CSS plus custom CSS
- SQLite in development via `bun:sqlite`
- Online production hosting: **Firebase** — Cloud Firestore (`DB_PROVIDER=firebase`, `lib/db-firebase.ts`, `lib/firebaseAdmin.ts`), Firebase Storage (`lib/storage.ts`), Firebase Hosting / App Hosting (`firebase.json`, `apphosting.yaml`), strict deny-client-SDK rules (`firestore.rules`, `storage.rules`)
- Legacy optional production: Supabase / PostgreSQL (`DB_PROVIDER=supabase`)
- Security stack: PBKDF2-SHA256 passwords & terminal PINs, AES-256-GCM encrypted TOTP 2FA secrets (`lib/security.ts`), SHA-256 hashed stateful `sessions` (`lib/authUtils.ts`), sliding-window rate limiting (`lib/rateLimit.ts`), HTTP security headers (`server/middleware/security.ts`), and secret-stripping DTO mappers (`lib/mappers.ts`)

Important files:

- `README.md`: high-level project overview. Some text may have encoding artifacts and may lag behind code.
- `lib/db.ts`: database adapter switch based on `DB_PROVIDER` / `DEV_MODE` (`sqlite`, `firebase`, `supabase`).
- `lib/db-firebase.ts` & `lib/firebaseAdmin.ts`: Cloud Firestore `DbAdapter` + Firebase Admin SDK singleton (`__schema_meta` tracking + SQL-to-Firestore translation).
- `lib/security.ts`, `lib/rateLimit.ts`, `lib/mappers.ts`: AES-256-GCM encryption, RFC 6238 TOTP & QR code generation, single-use backup codes, rate limiting, and DTO field mapping.
- `server/middleware/security.ts`: strict HTTP security headers across all responses.
- `lib/db-sqlite.ts`: local SQLite adapter; creates `dev.db`.
- `lib/uiTypes.ts`: shared layout, element, theme, and runtime event types.
- `lib/builderPresets.ts`: starter terminal layouts (the actual presets).
- `lib/stationObjects.ts`: reusable real-world workstation objects.
- `lib/starterWorkstations.ts`: terminal layout variant definitions.
- `lib/workspaceBranding.ts`: layout bundles, palette building, logo palette extraction, theme application.
- `lib/permissions.ts`: role/permission presets for terminals.
- `server/utils/managedTerminals.ts`: creates starter terminals and applies layout variants/branding.
- `server/utils/starterTables.ts`: ensures products, orders, and inventory tables.
- `components/OnboardingModal.vue`: onboarding flow and workspace creation UI.
- `components/PropertiesPanel.vue`: builder configuration controls.
- `components/Canvas.vue`: builder canvas and terminal preview shell.
- `components/elements/CartWidgetEl.vue`: cashier cart, payment, card-reader-ready behavior, receipt printing.
- `components/elements/TableViewEl.vue`: table rendering and refresh.
- `pages/dashboard/builder.vue`: main UI builder.
- `pages/dashboard/terminals/index.vue`: terminal list, create flow, copy link/PIN, thumbnails.
- `pages/dashboard/terminals/[id].vue`: terminal options/detail view.
- `pages/terminal/[id].vue`: private terminal runtime.
- `pages/t/[slug].vue`: public terminal runtime.
- `server/api/runtime/event.post.ts`: runtime action execution and permissions.

---

## Data Model Notes

Platform tables:

- `businesses`
- `terminals`
- `presets`
- `audit_log`

Starter business tables (created during onboarding):

- `products`
- `orders`
- `inventory`

Important order fields:

- `items` / `line_items`
- `total`
- `status` (`pending`, `preparing`, `fulfilled`, `served`)
- `table_number`
- `staff_name`
- `payment_method`
- `payment_status`
- `payment_reference`
- `receipt_number`

In local dev mode, business tables use prefixed names in SQLite based on the business schema name.

---

## Design Direction

The UI should feel like a polished daily operations tool, not a raw developer console.

- Warm cream and maroon base identity.
- Compact cards and panels with restrained rounded corners.
- Premium but practical admin surfaces.
- Staff terminals: high contrast, readable, task-focused.
- Layout bundles keep generated terminals visually consistent.
- Individual widgets can be customized for variety.
- Avoid drifting into developer-first language in any user-facing area.

---

## Documentation Pass — June 2026

This pass updated:

- `DESIGN-DOCUMENT.md`
- `HANDOFF.md`

Why:
- Project identity was updated to clearly frame Kogane as a **preset-driven terminal system** rather than a generic internal tool builder.
- Usage examples were added to make the value proposition concrete.
- Explicit exclusions were added to prevent scope creep and set correct expectations with stakeholders.

Files touched:
- `DESIGN-DOCUMENT.md`
- `HANDOFF.md`

Verification:
- No app code was changed in this pass.

## Final Documentation And CBA Pass

This pass created the Week 12 final submission deliverables from the assignment screenshots:

- `Kogane Final Documentation.docx`
- `Kogane Cost-Benefit Analysis.xlsx`

Why:

- The assignment required a simplified final project documentation document with executive summary, project overview, deliverables summary, lessons learned, and recommendations.
- The assignment also required a simplified cost-benefit analysis table with BCR and economic feasibility explanation.
- The deliverables use `Context/1` through `Context/7` as project history, but the current source of truth remains `HANDOFF.md`, `DESIGN-DOCUMENT.md`, `README.md`, and the current codebase.

CBA assumptions:

- First-year estimated cost: PHP 168,119.
- Estimated annual benefit: PHP 307,000.
- Benefit-cost ratio: about 1.83.
- Payback period: about 6.6 months.
- Development labor is valued for economic comparison even though the academic build keeps direct development cash cost at PHP 0.00.
- Pilot hardware/deployment cost is treated as optional context, not a required production dependency.

Verification:

- The Excel workbook was exported with formulas, inspected for formula errors, and visually checked through a rendered preview.
- The Word document was structurally checked with paragraph/table extraction and has about 1,097 words.
- DOCX visual render QA could not be completed because LibreOffice/`soffice` is not available in the local environment.
- Documentation was reviewed for consistency with the current codebase.

---

## Dashboard Terminals Section — June 2026

### What changed

Added a **Terminals category** to the dashboard overview (`pages/dashboard/index.vue`) that is now visible to **all users with a business set up**, not just Enterprise accounts.

Previously the entire terminals section was gated behind `isEnterprise`. This made no sense for standard users who had already gone through onboarding — their preset terminals (Cashier, Kitchen Display, etc.) were created but invisible on the overview.

### What the section shows

Each terminal from the preset gets its own card displaying:

- Terminal name and role label
- UI layout thumbnail preview
- Inline name editor
- PIN toggle (enable / disable public link mode)
- PIN show/change/copy controls (when PIN mode is on)
- Copy terminal link button
- Save settings button
- Settings icon link → `/dashboard/terminals/[id]`

The "Open full terminal manager" link at the top of the section is still gated to `v-if="isEnterprise"` since `/dashboard/terminals` redirects non-enterprise users back to `/dashboard`.

### Why

The preset terminals are created during onboarding for everyone. Hiding them from daily users on the overview was inconsistent with the product goal of letting any business owner manage their terminals without developer-level access.

### Files touched

- `pages/dashboard/index.vue`
  - `loadTerminals()`: removed `isEnterprise` guard; now loads whenever `business.value` is set
  - Terminals `<section>`: changed `v-if="isEnterprise"` → `v-if="business"`
  - Section header: hardcoded "Terminals / Your preset terminals" (removed locale indirection that wasn't needed for a hardcoded heading)
  - "Open full terminal manager" link: added `v-if="isEnterprise"` to prevent non-enterprise users from clicking into a page that redirects them away

### Verification

- Section will appear on the dashboard for any user who has completed onboarding and has a business record.
- Enterprise users see the full section plus the "Open full terminal manager" link.
- Non-enterprise users see the cards but not the manager link.
- No new API routes were added; `GET /api/terminals` was already accessible.

---

## Device Demo / LAN Deployment Pass

### What changed

- Added PC/LAN run scripts in `package.json`: `bun run dev:lan` and `bun run preview:lan`.
- Added `NUXT_PUBLIC_SHARE_ORIGIN` to Nuxt runtime config so copied terminal links can use a laptop LAN address instead of `localhost`.
- Added `composables/useShareOrigin.ts` and switched dashboard/terminal copy-link builders to use it.
- Added `.env.example` with safe local-development placeholders.
- Added concise README instructions for PC and same-Wi-Fi device demos. A standalone `DEVICE-DEMO.md` guide was created first, then removed in a follow-up because the user prefers to guide the teacher directly.
- Rewrote `README.md` to remove stale seed instructions and visible encoding artifacts.
- Removed the stale `seed:presets` package script because `scripts/seed-presets.ts` had already been deleted.

### Why

The user wants to show current Kogane progress to a teacher and open terminals from other devices. A normal local dev server is not enough for another phone/tablet/laptop to connect, and copied links that use `localhost` do not work outside the PC that created them.

### Files touched

- `package.json`
- `nuxt.config.ts`
- `.env.example`
- `README.md`
- `composables/useShareOrigin.ts`
- `pages/dashboard/index.vue`
- `pages/dashboard/terminals/index.vue`
- `pages/dashboard/terminals/[id].vue`
- `HANDOFF.md`

### What still needs work

- True real-time sync is still polling-based; kitchen/order updates are not yet push-based across devices.
- Windows Firewall, school Wi-Fi isolation, VPNs, or guest networks can still block another device from reaching the PC.
- The deleted generated documentation files and temporary context folders are no longer expected in the repo. They were project-management deliverables, not runtime dependencies.

### Verification

- `bun run build` completed successfully after rerunning outside the sandbox. The first sandboxed attempt failed at Nitro file tracing with `EPERM: operation not permitted, readlink 'C:\Users\Jaime'`, which was an environment permission issue rather than an app compile error.
- Build warnings observed: Node deprecation warning from `@vue/shared` package exports and Nitro treating `bun:sqlite` as an external dependency. These were warnings, not blockers.

---

## README Rebrand Cleanup

### What changed

- Removed the final public-facing Postfolio reference from `README.md`.
- Reworded the introduction so the README presents the project only as Kogane.

### Why

The README is likely to be shown or shared during teacher review, so it should not confuse readers with the old project name.

### Files touched

- `README.md`
- `HANDOFF.md`

### Verification

- `rg "Postfolio|postfolio" README.md` returns no matches.

---

## Production Deployment, Real-Time Synchronization & E-Commerce Removal Pass — October 2026

### What changed

1. **Eliminated all E-Commerce elements**:
   - Removed the `ecommerce` ("Online orders and fulfilment") preset from `components/OnboardingModal.vue`, leaving retail strictly focused on in-person counter workstations (`shop` and `boutique`).
   - Removed `'retail'` from the `deliveries` feature so deliveries is strictly a logistics route feature, not customer e-commerce parcel shipping.
   - Removed legacy `pos-screen` (with unconfigured `Checkout` button) and outdated empty placeholders (`inventory-list`, `login-screen`, `dashboard-charts`) from `lib/builderPresets.ts`.
   - Updated retail station default naming in `lib/starterWorkstations.ts` to `Cashier Register` (business workstation).
   - Renamed `checkout-summary` station object label and title to `Manual Order Intake` in `lib/stationObjects.ts`.

2. **Continuous Real-Time Synchronization Across Terminals**:
   - Created `server/utils/realtimeHub.ts`: an in-memory pub/sub broker for instant mutation distribution per business workspace.
   - Created `server/api/realtime/stream.get.ts`: a zero-configuration Server-Sent Events (SSE) streaming endpoint with heartbeat monitoring and clean client teardown.
   - Hooked `realtimeHub.publish` into all mutation routes (`server/api/runtime/event.post.ts`, `server/api/data/insert.post.ts`, `server/api/schema/tables/updateRow.post.ts`, `server/api/terminals/insert.post.ts`).
   - Created `composables/useRealtimeSync.ts` supporting dual SSE and Supabase Realtime subscriptions with automated reconnect.
   - Connected `useCanvasRuntime` to real-time streams: loaded query elements (orders, inventory, catalog, charts) now update live without manual page refreshes.
   - Updated `components/elements/TableViewEl.vue` and `components/elements/CartWidgetEl.vue` to listen for live table updates.

3. **Kitchen Display Order Status Mutation (Resolved Critical Gap)**:
   - Updated `kitchen-display` permissions in `lib/permissions.ts` to grant `update: true` on the `orders` table.
   - Added interactive status pills in `components/elements/TableViewEl.vue`: clicking an order status badge advances its state (`PENDING` → `PREPARING` → `FULFILLED`) using optimistic updates and live real-time broadcasts to cashier queues.

4. **Production Deployability & Containerization**:
   - Added `Dockerfile`: multi-stage production container build using `oven/bun:1-alpine` with healthcheck.
   - Added `.dockerignore` to keep image minimal.
   - Added `docker-compose.yml` for 1-command deployment with persistent volume mounting for SQLite.
   - Added `supabase/schema.sql`: complete PostgreSQL production schema for Supabase, including platform tables (`businesses`, `terminals`, `presets`, `audit_log`), RPC functions (`execute_query`, `execute_ddl`), indexes, and realtime publication rules.
   - Added `DEPLOYMENT.md`: comprehensive step-by-step production deployment guide covering Docker, Supabase, LAN multi-device demos, and environment variables.
   - Updated `.env.example` with complete configuration options.

### Why

The project is moving to official production readiness. Customer-facing e-commerce concepts (online carts, online deliveries) conflict with Kogane's charter as a specialized business workstation and terminal platform for staff. Stations required push-based live updates so kitchen displays, cashiers, and stock desks sync instantaneously across network devices.

### Files touched

- `components/OnboardingModal.vue`
- `components/elements/CartWidgetEl.vue`
- `components/elements/TableViewEl.vue`
- `composables/useCanvasRuntime.ts`
- `composables/useRealtimeSync.ts` (new)
- `lib/builderPresets.ts`
- `lib/permissions.ts`
- `lib/starterWorkstations.ts`
- `lib/stationObjects.ts`
- `server/api/data/insert.post.ts`
- `server/api/realtime/stream.get.ts` (new)
- `server/api/runtime/event.post.ts`
- `server/api/schema/tables/updateRow.post.ts`
- `server/api/terminals/insert.post.ts`
- `server/utils/realtimeHub.ts` (new)
- `.dockerignore` (new)
- `Dockerfile` (new)
- `docker-compose.yml` (new)
- `supabase/schema.sql` (new)
- `.env.example`
- `DEPLOYMENT.md` (new)
- `tests/presets-ecommerce-removal.test.ts` (new)
- `tests/realtime.test.ts` (new)
- `HANDOFF.md`

### Verification

- Ran `bun test`: all 11 unit & integration tests pass cleanly across 3 test files.
- Ran `bun run build`: full Nuxt 3 / Nitro production build succeeded with exit code 0 (`✨ Build complete!`).
- Validated server entry `.output/server/index.mjs` executes properly.

---

## Known Gaps & What Needs Work

### Critical / Blocking

- **Kitchen order status controls are missing.** The Kitchen Display preset is currently read-only. There is no way for kitchen staff to move an order from `pending` → `preparing` → `fulfilled`. The data model has the `status` field but the terminal UI and the server-side event handler do not expose a mutation action for it. This needs a new station object (or a configurable button widget) with an `UPDATE orders SET status = ? WHERE id = ?` event bound to it, plus a matching permission preset that allows kitchen terminals to update `orders.status` only.
- **Text encoding artifacts.** Some Vue component labels, README sections, and locale strings contain corrupted characters (likely from encoding during copy-paste or PDF extraction). These need a manual cleanup pass.

### High Priority

- **Localization coverage is incomplete.** Not all UI strings are covered by locale files. The `fil` → `ph` migration should be verified and any leftover `fil` references removed.
- **Onboarding copy uses developer language.** Words like "schema", "DDL", and "runtime" appear in onboarding UI text that is aimed at non-technical business owners. These should be rewritten in plain language (e.g., "your data tables", "set up your workspace").
- **First-run sample data is thin.** After onboarding, terminals launch with empty or near-empty data. Seeding demo products and orders would make first-run demos much more impressive and functional for evaluation.
- **Terminal layout previews are missing.** During onboarding, users pick terminal layout variants without seeing a visual preview. Adding small preview thumbnails would significantly improve the selection experience.

### Medium Priority

- **Receipt templates are basic.** The current receipt output is a simple browser print. There is no way to configure a receipt logo, header, or footer template. This should be a configurable panel in terminal settings.
- **Role permissions are coarse.** Permissions currently rely mostly on wildcard presets (e.g., full read/write on all business tables). A more granular system where each terminal can allow/deny per-table and per-action would be more secure and flexible.
- **Real-time sync is polling-based.** The kitchen display and other auto-refresh widgets use interval polling. For true multi-device live updates, a WebSocket or Supabase Realtime channel should be added.
- **More station objects needed.** The registrar, inventory, kitchen, and reports presets would benefit from additional reusable workstation objects (e.g., an order status toggle card, a receiving intake form, a supplier lookup widget).
- **Card reader bridge is not implemented.** The cashier simulates a card reader flow but there is no actual bridge process. A future pass should define the protocol for a local hardware bridge (e.g., via a localhost WebSocket or COM port relay).

### Low Priority / Nice To Have

- **More chart presets and report templates.** The reports preset is functional but has limited default chart types and report layouts.
- **Logo palette extraction edge cases.** Color extraction from uploaded logos can produce poor results for logos with transparent backgrounds or low-contrast palettes. Fallback logic should be improved.
- **Settings page completeness.** The settings page allows re-running onboarding and adjusting branding but may be missing some controls (e.g., individual terminal re-theming without a full rebuild).

---

## Current Git Caveats

At the time the initial handoff was written:

- `scripts/seed-presets.ts` was deleted by prior work/user cleanup. `package.json` no longer references `seed:presets`.
- Temporary `context` folders were untracked and intended to be deleted by the user.
- `.devserver.out.log` was modified.

Do not restore or revert those changes unless the user explicitly asks.

---

## Operating Guidance For Future AI

- Start by reading `HANDOFF.md`, then `DESIGN-DOCUMENT.md`, then `README.md`.
- Treat historical PDFs or context folders as background only. Prefer current code.
- When in doubt, preserve the preset-first, user-friendly philosophy. Keep language simple for daily business users.
- Kogane is not a payment system. Do not add real money flows.
- Update this handoff after every meaningful prompt — include why a decision was made, not just what files changed.
- When implementing new terminal features, check `lib/uiTypes.ts`, `lib/builderPresets.ts`, and `lib/stationObjects.ts` first to understand existing type and layout conventions before adding new ones.
- **Session Log Protocol (Mandatory)**: Every future AI session MUST read `HANDOFF.md` at startup to capture project direction, redirections, prior changes, and recommendations, and MUST append a dated session log below upon completion recording: (1) any project redirection and its rationale, (2) exact changes and files touched, (3) empirical verification results, and (4) next recommendations.

---

## Firebase Online Hosting, Security Hardening, Stateful Sessions & 2FA Migration Pass — November 2026

### Project Direction & Redirection

- **Redirection Decision**: Redirected production deployment away from local-only hosting (`dev.db` SQLite + LAN executable) and optional Supabase toward **Firebase Online Hosting** (Firebase App Hosting / Firebase Hosting + Nitro Cloud Functions Gen 2, Cloud Firestore, and Firebase Storage).
- **Why**: Local-only SQLite/LAN deployment limits multi-location access, remote management, managed TLS/HTTPS, and operational durability for long-term multi-user SaaS hosting. Retaining local SQLite behind `DEV_MODE=true` preserves zero-config local testing while `DB_PROVIDER=firebase` powers online production.

### What Changed

1. **Firebase Online Hosting, Cloud Firestore & Firebase Storage Migration**:
   - Added `lib/firebaseAdmin.ts`: Firebase Admin singleton supporting `FIREBASE_SERVICE_ACCOUNT_JSON` (raw JSON or Base64), `FIREBASE_PROJECT_ID` / `FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY`, or Application Default Credentials (`applicationDefault()`).
   - Added `lib/db-firebase.ts`: `FirestoreAdapter` implementing `DbAdapter` plus `InMemoryFirestoreStore` for offline unit testing. Translates parameterized SQL (`SELECT` with `JOIN`, `WHERE`, `COLLATE NOCASE`, `datetime()`, `LIKE`, `IS NULL`, `ORDER BY`, `LIMIT`, `OFFSET`, `COUNT(*)`, `INSERT`, `UPDATE`, `DELETE`, `PRAGMA table_info`, `sqlite_master`, `CREATE TABLE`, `ALTER TABLE`, `DROP TABLE`) against Firestore collections and `__schema_meta`.
   - Updated `lib/db.ts` (`DbProvider = 'sqlite' | 'firebase' | 'supabase'`, dynamic `getDbProvider()`, `setDbAdapterForTest()`, `resetDbAdapter()`) and refactored prefix-table dialect checks across `server/utils/business.ts`, `server/utils/businessTable.ts`, `server/utils/starterTables.ts`, `server/utils/salesMetrics.ts`, `server/api/data/query.post.ts`, `server/api/presets/apply.post.ts`, `server/api/businesses/create.post.ts`, `server/api/businesses/onboard.post.ts`, `server/api/schema/tables/*.ts`, and `server/api/terminals/insert.post.ts`.
   - Updated `lib/storage.ts` to add `FirebaseStorageAdapter` using Cloud Storage via Firebase Admin when Firebase is active.
   - Added Firebase deployment configs: `firebase.json`, `apphosting.yaml`, `.firebaserc`, `firestore.rules`, `firestore.indexes.json`, `storage.rules`, updated `nuxt.config.ts` (`runtimeConfig` + `nitro.firebase` Gen 2 config), `package.json` (`build:firebase` / `deploy:firebase`), and `.env.example`.

2. **Security, Cryptography, Hashing, Mapping & Rate Limiting**:
   - Created `lib/security.ts`: `getSessionSecret`, constant-time `timingSafeEqualStr`, `hashTokenSha256`, AES-256-GCM `encryptSecret` / `decryptSecret` (for at-rest 2FA secrets), Base32 encode/decode, RFC 6238 TOTP generation/verification, `buildOtpAuthUri`, `generateQrDataUrl` (via `qrcode`), salted single-use backup recovery codes (`generateBackupCodes` / `verifyAndConsumeBackupCode`), and `isSafeRedirectPath`.
   - Updated `lib/authUtils.ts` with salted PBKDF2-SHA256 PIN hashing (`hashPin` -> `pin_pbkdf2$100000$...`) + legacy SHA-256 verification and transparent upgrade in `server/api/terminals/login.post.ts`.
   - Created `lib/rateLimit.ts`: sliding-window rate limiter with `Retry-After` & HTTP 429 enforcement applied to admin login, signup, 2FA verification/setup/disable, and terminal PIN login.
   - Created `lib/mappers.ts`: DTO field mappers stripping `password_hash`, `pin_hash`, `two_factor_secret`, `two_factor_backup_codes`, and `token_hash` before serializing responses, plus `normalizeEmail` and User-Agent device summarization.
   - Created `server/middleware/security.ts`: injects `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, `X-XSS-Protection`, and HTTPS `Strict-Transport-Security`.

3. **Fixed Admin & Terminal Logins + Stateful Sessions**:
   - Added persistent `sessions` schema in `lib/db-sqlite.ts` (and Firestore `sessions` collection) storing SHA-256 `token_hash`, `session_type` (`admin` | `terminal`), `two_factor_verified`, `ip_address`, `user_agent`, `last_active_at`, `expires_at`, and `revoked_at`.
   - Updated `lib/authUtils.ts` to persist, validate, refresh, and revoke stateful admin & terminal sessions, reject `dev-admin-token` in real production, validate HMAC signatures with timing-safe comparison, use HTTPS-aware cookie `secure` flags (`isSecureRequest`), and accept both `HttpOnly` cookies (`kogane_admin_session`, `kogane_term_<id>`) and `Bearer` / `x-terminal-session` headers.
   - Fixed `composables/useAuth.ts`, `app.vue`, `layouts/dashboard.vue`, `pages/index.vue`, and `pages/login.vue`: added `hydrateSession()` against `GET /api/auth/me` before dashboard auth-guard redirects (fixing production refresh logouts and stale `localStorage` redirect loops), gated demo autofill behind `runtimeConfig.public.devMode`, validated safe redirects, and fixed `server/api/terminals/logout.post.ts` (`await clearTerminalSession(event, targetTerminalId)`) and `server/api/terminals/insert.post.ts` (`verifyTerminalSession`).
   - Added `GET /api/auth/sessions` and `POST /api/auth/sessions/revoke` + updated `POST /api/auth/change-password` to revoke all other active sessions.

4. **End-to-End Two-Factor Authentication (2FA)**:
   - Added `two_factor_enabled`, `two_factor_secret`, `two_factor_backup_codes`, `two_factor_verified_at` user columns + migrations in `lib/db-sqlite.ts`.
   - Implemented `POST /api/auth/2fa/setup`, `enable`, `verify`, `disable`, and `backup-codes`.
   - Updated `POST /api/auth/login` to issue a short-lived pending challenge token when 2FA is enabled (`verifyAdmin` blocks unverified pending tokens) and complete login only after TOTP or single-use backup code verification in `/api/auth/2fa/verify`.
   - Replaced fake QR placeholder in `pages/login.vue` with real QR scan + manual setup key + 2FA login challenge + backup code recovery view, and added **Two-Factor Authentication** and **Active Sessions** management cards in `pages/dashboard/settings.vue`.

### Verification Results

- `bun test`: **160 pass, 0 fail** (1,102 expect() calls across 18 test files), including new `tests/firebase-security-2fa-sessions.test.ts` (12 tests covering AES-256-GCM encryption, PBKDF2 PIN hashing/upgrade, TOTP/QR/single-use backup codes, DTO mappers, `FirestoreAdapter` CRUD/JOIN/DDL/full auth flow, stateful session revocation, 2FA login challenge lifecycle, and 429 rate limiting).
- `bun run build` (`node-server` preset): exited with code 0 (`✨ Build complete!`).
- `bun run build:firebase` (`Nitro preset: firebase` Cloud Functions Gen 2 + `.output/public`): exited with code 0 (`✨ Build complete!`).
- **Not verified live**: Actual deployment (`firebase deploy`) against a live GCP/Firebase project and live browser E2E testing were not executed because no Firebase project credentials or running interactive browser environment exist in this workspace.

### Recommendations & Next Steps for Future AI

1. **Provision Live Firebase Project & Secrets**: Update `.firebaserc` with the real project ID, set `SESSION_SECRET`, `ENCRYPTION_KEY`, and `FIREBASE_SERVICE_ACCOUNT_JSON` in Firebase App Hosting / Functions secret manager, and deploy `firestore.rules`, `firestore.indexes.json`, and `storage.rules` via `firebase deploy`.
2. **Real-Time Multi-Instance Sync on Firebase**: In-memory `realtimeHub.ts` broadcasts within a single Node/Cloud Run instance; if scaling to multiple Cloud Functions / App Hosting instances, bridge `realtimeHub` over Firestore `onSnapshot` listeners or Redis/PubSub so kitchen displays receive cross-instance events instantly.
3. **Browser E2E Login / 2FA Smoke Test**: Exercise `/login` (signup with 2FA QR scan, login with 2FA challenge, backup code consumption) and `/dashboard/settings` (active session revocation across two browser contexts) against the running Nuxt server.
4. **Admin Email Verification & Password Reset**: Add verified-email / forgot-password token delivery once an outbound email provider (e.g., Resend / SendGrid / Firebase Trigger Email) is configured.


---

### Session Log — 2026-11-12 (Verification Review & Hardening Pass)

- **Context & Direction Check**: Confirmed redirection from local SQLite/LAN hosting to Firebase Hosting / App Hosting, Cloud Firestore, and Firebase Storage while keeping `DEV_MODE=true` SQLite intact for local tests and offline dev. No new scope redirection introduced.
- **Defects Found & Fixed**:
  1. **Session Hydration Schema Mismatch (`composables/useAuth.ts`)**: `GET /api/auth/me` (`mapUserRecordToDto`) returns `user.id` and `user.profilePhotoUrl`, whereas `hydrateSession()` previously read `data.user.userId` and `data.user.profilePicture`, overwriting `session.value.userId` with `undefined` on mount/refresh. Fixed `hydrateSession()` to resolve `data.user.userId || data.user.id` and `data.user.profilePicture ?? data.user.profilePhotoUrl`, and clear stale local state if neither ID is present.
  2. **Firestore SQL `IN` / `NOT IN` & Schema Name Resolution (`lib/db-firebase.ts`)**:
     - Added `[NOT] IN (...)` predicate evaluation inside `evaluateWhereRows()` so queries such as `server/api/reports/table-activity.get.ts` (`action_type IN ('insert', 'update', 'delete')`) filter accurately instead of returning unfiltered rows.
     - Fixed `extractSchemaAndShortName()`'s greedy regex and added `resolveSchemaAndShortName()` backed by `businesses.schema_name` lookup so multi-underscore tenant table names (`order_items` under `biz_usr_1234`, `menu_items` under `tenant_abc`) map accurately in `__schema_meta`.
  3. **Firebase Storage Runtime Detection (`lib/storage.ts`) & Dynamic Reporting Dialect (`server/api/reports/custom.post.ts`)**:
     - Updated `FirebaseStorageAdapter.getBucketName()` and `useStorage()` to recognize `GCLOUD_PROJECT`, `GOOGLE_CLOUD_PROJECT`, and `FIREBASE_CONFIG` JSON (alongside `FIREBASE_PROJECT_ID` / `FIREBASE_STORAGE_BUCKET`), preventing silent fallback to local `DevStorageAdapter` on Firebase App Hosting / Cloud Functions.
     - Switched `server/api/reports/custom.post.ts` from module-load `isDevDb` to dynamic `isPrefixDb()`.
  4. **Sensitive Auth/2FA Endpoint Rate Limiting (`server/api/auth/2fa/{enable,disable,backup-codes}.post.ts`, `server/api/auth/change-password.post.ts`)**: Added `enforceRateLimit` / `recordRateLimitAttempt` / `clearRateLimit` (HTTP 429 + `Retry-After`) to prevent brute-forcing 6-digit TOTP codes or current passwords from an active session.
  5. **Client Hydration & Terminal Auth Consistency (`layouts/marketing.vue`, `pages/terminal/[id].vue`)**: Switched marketing layout and terminal page mount hydration from `loadDevSession()` to `hydrateSession()`, passed stored `x-terminal-session` headers on terminal session/logout requests, and surfaced HTTP 429 rate-limit messages in `friendlyTerminalMessage()`.
- **Verification Executed**:
  - `bun test`: **165 pass, 0 fail** (1,167 assertions across 18 files), including 5 new regression tests in `tests/firebase-security-2fa-sessions.test.ts` covering `useAuth.hydrateSession()` <-> `GET /api/auth/me`, Firestore `IN` / `NOT IN` & multi-underscore schema metadata, `table-activity` under `FirestoreAdapter`, `useStorage()` GCP/Firebase env resolution, and HTTP 429 rate limiting on `2fa/enable`, `2fa/disable`, `2fa/backup-codes`, and `change-password`.
  - `bun run build`: Exited 0 (`.output/server/index.mjs`, Nitro `node-server`).
  - `bun run build:firebase`: Exited 0 (`Nitro preset: firebase`, `.output/server` + `.output/public`).
- **Remaining Recommendations for Next Session**:
  1. Replace the placeholder project ID in `.firebaserc`, configure runtime secrets (`SESSION_SECRET`, `ENCRYPTION_KEY`, `FIREBASE_SERVICE_ACCOUNT_JSON`), and run a live smoke test against Cloud Firestore and Firebase Storage (`RealFirestoreStore` + `FirebaseStorageAdapter`).
  2. Run a Playwright or manual browser walkthrough of `/login`, `/dashboard/settings`, `/pricing`, and `/terminal/[id]` (cookie handling, QR scan 2FA challenge, session revocation, terminal rate limit error banner).

---

### Session Log — 2026-11-12 (Typecheck, Rate-Limit & Firebase Config Cleanup Pass)

- **Context & Direction Check**: Continued on the Firebase online hosting, security hardening, stateful sessions, and 2FA architecture (`DEV_MODE=true` SQLite for local/offline dev; `DB_PROVIDER=firebase` + Cloud Firestore / Firebase Storage / Nitro `firebase` Gen 2 preset for online production). No scope redirection introduced.
- **Changes Made**:
  1. **`composables/useAuth.ts`**: Removed unreachable duplicate `clearLocalSession()` after `return null;` in `hydrateSession()` and ensured `isHydrated.value = true;` is set before returning `null` when `/api/auth/me` returns no user.
  2. **`lib/rateLimit.ts`**: Replaced truthiness check on `event?.node?.res?.setHeader` with `typeof ... === 'function'` (`TS2774`) and passed numeric `result.retryAfterSeconds` to `setResponseHeader(event, 'Retry-After', ...)` (`TS2345`).
  3. **Route Handler & Test Type Safety**: Fixed `.catch(() => ({}))` union widening in `server/api/auth/{login,signup,change-password}.post.ts`, `server/api/auth/sessions/revoke.post.ts`, and `server/api/auth/2fa/{backup-codes,disable,enable,verify}.post.ts`; typed `business` in `server/api/businesses/onboard.post.ts`; and narrowed `setupRes.secret` in `tests/firebase-security-2fa-sessions.test.ts`.
  4. **`server/api/storage/upload.post.ts`**: Kept `actorType` strictly typed as `AuditActorType | null` (`'admin' | 'inpoint' | null`), skipped `writeAuditLog` for unauthenticated guest uploads (`businessId === null`), and added sliding-window IP rate limiting (`guest_image_upload`, 10 attempts / 15 min, HTTP 429 + `Retry-After`) for unauthenticated image uploads.
  5. **`lib/firebaseAdmin.ts` & `lib/storage.ts`**: Added `parseFirebaseConfig()`, `resolveFirebaseProjectId()`, and `resolveFirebaseStorageBucket()` so deployments supplying only `FIREBASE_SERVICE_ACCOUNT_JSON` (raw or Base64, without explicit `FIREBASE_PROJECT_ID` or `FIREBASE_STORAGE_BUCKET`) resolve `projectId` and `<project_id>.firebasestorage.app` across Firebase Admin initialization, `FirebaseStorageAdapter.getBucketName()`, and `useStorage()` mode detection.
  6. **`server/api/terminals/logout.post.ts`**: Added `terminal_pin` sliding-window rate limiting (10 attempts / 5 min, HTTP 429 + `Retry-After`) on terminal PIN logout while preserving admin passthrough bypass.
- **Verification Results**:
  - `bunx tsc --noEmit`: 0 errors across all touched source files (`composables/useAuth.ts`, `lib/rateLimit.ts`, `lib/firebaseAdmin.ts`, `lib/storage.ts`, `server/api/auth/**`, `server/api/businesses/onboard.post.ts`, `server/api/storage/upload.post.ts`, `server/api/terminals/logout.post.ts`); remaining `tsc` errors are pre-existing in unrelated files (`useCanvas*`, `builderPresets.ts`, `workspaceBranding.ts`, `salesMetrics.ts`, `taxFiling.ts`, `tailwind.config.ts`, `scripts/*`, and `bun:sqlite`/`bun:test` module declarations).
  - `bun test`: **169 pass, 0 fail** (1,218 assertions across 18 files), including 4 new regression tests in `tests/firebase-security-2fa-sessions.test.ts` covering `useAuth.hydrateSession()` null-user hydration state, `FIREBASE_SERVICE_ACCOUNT_JSON` fallback in `firebaseAdmin`/`useStorage`, `/api/terminals/logout` PIN rate limiting + admin bypass, and `/api/storage/upload` guest image rate limiting + PDF rejection.
  - `bun run build` (`Nitro preset: node-server`): exited 0 (`✨ Build complete!`).
  - `bun run build:firebase` (`Nitro preset: firebase` Gen 2, `.output/nitro.json` verified): exited 0 (`✨ Build complete!`).
- **Deployment Notes & Next Recommendations**:
  1. Deploying with `FIREBASE_SERVICE_ACCOUNT_JSON` alone now configures Firestore and Storage buckets automatically (`<project_id>.firebasestorage.app`); still set `SESSION_SECRET`, `ENCRYPTION_KEY`, and update `.firebaserc` before `firebase deploy`.
  2. Live `firebase deploy` against a provisioned Firebase project and Playwright/manual browser E2E verification remain unexecuted in this offline workspace.

---

### Session Log — 2026-11-12 (Independent Security Review & Final Verification Pass)

- **Context & Direction Check**: Confirmed continuation on the Firebase online hosting, security hardening, stateful sessions, and 2FA architecture (`DEV_MODE=true` SQLite for local/offline dev; `DB_PROVIDER=firebase` + Cloud Firestore / Firebase Storage / Nitro `firebase` Gen 2 preset for online production). No scope redirection introduced.
- **Defects Found & Fixed**:
  1. **Cross-Tenant Admin Bypass on Terminal Logout (`server/api/terminals/logout.post.ts`)**: `adminUserId` was extracted from `verifyAdmin(event)` but never matched against the target terminal's business owner, allowing an authenticated admin of a different business to bypass PIN verification and write `'admin'` logout audit entries to another tenant. Fixed by verifying `businesses.admin_user_id = adminUserId` for `terminal.business_id` before allowing admin passthrough, and normalizing `body.pin` string validation.
  2. **Unauthenticated SVG Upload & Path Traversal Error Handling (`server/api/storage/upload.post.ts`)**: Restricted unauthenticated guest uploads to raster images only (`GUEST_IMAGE_TYPES`: `jpeg`, `png`, `webp`, `gif`, excluding `image/svg+xml` to prevent inline SVG script XSS via `/api/dev/storage/...`) while keeping `image/svg+xml` enabled for authenticated business admins/terminals, and wrapped `sanitizeStoragePath` in `try/catch` to return clean `{ url: null, error: 'Invalid storage path' }` responses.
  3. **Settings Logo Upload Auth Headers (`pages/dashboard/settings.vue`)**: Added `credentials: 'include'` and `headers: authHeaders()` to `uploadLogo()` so Bearer-authenticated admins upload to `biz-${businessId}` with audit logging rather than falling back to the rate-limited guest upload path.
  4. **Explicit `DB_PROVIDER` Precedence in Storage (`lib/storage.ts`)**: Updated `useStorage()` so explicit `DB_PROVIDER=sqlite` or `DB_PROVIDER=supabase` (without `FIREBASE_STORAGE_BUCKET`) is not overridden by ambient GCP environment variables (`GCLOUD_PROJECT`, `GOOGLE_CLOUD_PROJECT`, `FIREBASE_CONFIG`).
- **Verification Executed**:
  - `bun test`: **170 pass, 0 fail** (1,227 assertions across 18 files), including new regression tests in `tests/firebase-security-2fa-sessions.test.ts` covering cross-tenant terminal logout rejection, guest SVG/path-traversal rejection + admin SVG upload, and `DB_PROVIDER=sqlite` storage precedence under ambient `GCLOUD_PROJECT`.
  - `bunx tsc --noEmit`: 0 errors across all touched source files (`composables/useAuth.ts`, `lib/rateLimit.ts`, `lib/firebaseAdmin.ts`, `lib/storage.ts`, `server/api/auth/**`, `server/api/businesses/onboard.post.ts`, `server/api/storage/upload.post.ts`, `server/api/terminals/logout.post.ts`, `pages/dashboard/settings.vue`); only pre-existing `TS2307` (`bun:test`) remains in `tests/firebase-security-2fa-sessions.test.ts`.
  - `bun run build` (`Nitro preset: node-server`) and `bun run build:firebase` (`Nitro preset: firebase` Gen 2): both exited 0 (`✨ Build complete!`).
- **Remaining Recommendations**:
  1. Provision a live Firebase project (`.firebaserc`, `SESSION_SECRET`, `ENCRYPTION_KEY`, `FIREBASE_SERVICE_ACCOUNT_JSON`) and verify live `RealFirestoreStore`, `FirebaseStorageAdapter`, and `firebase deploy`.
  2. Run a real browser E2E walkthrough covering `/login` (2FA QR + backup codes), `/dashboard/settings` (logo upload, 2FA, session revocation), and `/terminal/[id]` (PIN rate limiting & logout).

---

### Session Log — 2026-11-12 (Firebase Spark Free-Tier Architectural Workaround)

- **Project Direction & Redirection**:
  - **Redirection Decision**: Adapted online production deployment for the user's free **Firebase Spark** project (`kogane-e7f2b`, Firestore region `asia-southeast1`) without requiring a Blaze billing upgrade (`Cloud Functions Gen 2`, `Firebase App Hosting`, and `Firebase Storage` all require Blaze, whereas **Cloud Firestore** is free on Spark).
  - **Architectural Workaround**: Keep **Cloud Firestore** (`DB_PROVIDER=firebase`) as the free online database, replace Blaze Firebase Storage with `FirestoreStorageAdapter` (`__storage_blobs` collection), and replace Blaze Cloud Functions / App Hosting with either a zero-card free Node PaaS (`render.yaml` / `Dockerfile` for Render / Koyeb / Fly) or a local Node/Bun host connected online to Firestore + `bun run tunnel` HTTPS URL & QR.
- **What Changed**:
  1. **Spark-Free Asset Storage (`lib/storage.ts`, `lib/db-firebase.ts`, `server/utils/storageServe.ts`, `server/api/storage/files/[...path].get.ts`, `server/api/dev/storage/[...path].get.ts`, `server/api/storage/upload.post.ts`)**:
     - Added `FirestoreStorageAdapter` (`FIRESTORE_STORAGE_COLLECTION = '__storage_blobs'`, `FIRESTORE_STORAGE_MAX_BYTES = 700 * 1024`) storing small assets/logos/avatars via `db` using SHA-256 hex document IDs (no `/` in Firestore doc IDs), enforcing the 700 KB binary guard under Firestore's 1 MiB document limit, rejecting trailing-slash object keys, and returning `/api/storage/files/<safeBucket>/<safePath>`.
     - Added O(1) `getById` / `delete` fast-paths for `id = ?` lookups, updates, and deletes in `FirestoreAdapter` (`lib/db-firebase.ts`) and skipped `businesses` schema-meta scans on platform collections (`__storage_blobs`, `sessions`, `users`, `terminals`, etc.) so `/api/storage/files/...` reads do not trigger full-collection Firestore scans on Spark quotas.
     - Updated `useStorage()` to activate `FirestoreStorageAdapter` via `STORAGE_PROVIDER=firestore`, `FIREBASE_SPARK_MODE=true`, or `DB_PROVIDER=firebase` without an explicit `FIREBASE_STORAGE_BUCKET` or Blaze GCP runtime env (`GCLOUD_PROJECT` / `GOOGLE_CLOUD_PROJECT` / `FIREBASE_CONFIG`), keeping existing Blaze/explicit-bucket tests working.
     - Created `server/utils/storageServe.ts` and `server/api/storage/files/[...path].get.ts` (and aligned `server/api/dev/storage/[...path].get.ts`) to serve stored files via `useStorage().read(...)` with traversal rejection (HTTP 400), `Content-Type`, `X-Content-Type-Options: nosniff`, `Cache-Control: public, max-age=31536000, immutable`, and `Content-Security-Policy: sandbox` for `image/svg+xml`.
     - Updated `server/api/storage/upload.post.ts` to catch `FirestoreStorageAdapter` size limit / storage errors and return `{ url: null, error }` with HTTP 413/500 cleanly.
  2. **Project Config, Security Ignores & Free Node Hosting (`render.yaml`, `Dockerfile`, `.firebaserc`, `.gitignore`, `.dockerignore`, `.env.example`, `nuxt.config.ts`, `DEPLOYMENT.md`)**:
     - Updated `.firebaserc` default project ID to `kogane-e7f2b`.
     - Updated `.gitignore` and `.dockerignore` to exclude `*firebase-adminsdk*.json`, `service-account*.json`, `firebase-credentials*.json`, and `dev-storage/`.
     - Updated `.env.example`, `nuxt.config.ts`, and `DEPLOYMENT.md` to document `STORAGE_PROVIDER=firestore`, `FIREBASE_SPARK_MODE=true`, `asia-southeast1` alongside `us-central1`, and both zero-card Spark workarounds (Free Node PaaS + Spark Firestore, and local host + Spark Firestore + `bun run tunnel`).
     - Added `render.yaml` (Render Free Web Service running `node .output/server/index.mjs` with `DB_PROVIDER=firebase`, `STORAGE_PROVIDER=firestore`, `DEV_MODE=false`, `COOKIE_SECURE=true`, `FIREBASE_PROJECT_ID=kogane-e7f2b`, `FIREBASE_REGION=asia-southeast1`) and updated `Dockerfile` (`NITRO_PRESET=node-server`, dynamic `${PORT:-3000}` healthcheck).
  3. **Tests (`tests/firebase-security-2fa-sessions.test.ts`)**:
     - Added tests covering `useStorage()` Spark mode selection (`STORAGE_PROVIDER=firestore`, `FIREBASE_SPARK_MODE=true`, `DB_PROVIDER=firebase` without bucket vs explicit Blaze bucket), `FirestoreStorageAdapter` CRUD/upsert/list/700 KB limit/traversal rejection, and `/api/storage/upload` + `/api/storage/files/[...path]` serving, SVG `Content-Security-Policy: sandbox`, `nosniff`, 404, traversal rejection (400), and 413 oversized payload handling.
- **Verification Results**:
  - `bun test`: **173 pass, 0 fail** (1,269 expect() calls across 18 files).
  - Targeted `bunx tsc --noEmit`: 0 errors in all touched source files (`lib/storage.ts`, `server/utils/storageServe.ts`, `server/api/storage/files/[...path].get.ts`, `server/api/dev/storage/[...path].get.ts`, `server/api/storage/upload.post.ts`, `nuxt.config.ts`); only pre-existing `TS2307` (`bun:test`) in `tests/firebase-security-2fa-sessions.test.ts`.
  - `bun run build`: Exited 0 (`✨ Build complete!`, Nitro `node-server` `.output/server/index.mjs`).
- **Next Recommendations**:
  1. Deploy Firestore rules/indexes (`firebase deploy --only firestore` — free on Spark) and push to Render / Koyeb using `render.yaml` or `Dockerfile` with `FIREBASE_SERVICE_ACCOUNT_JSON` set in the PaaS dashboard.
  2. Run a live smoke test against `kogane-e7f2b` (`asia-southeast1`) verifying admin signup/login, logo upload to `__storage_blobs`, and `/api/storage/files/...` serving in a real browser.

---

### Session Log — 2026-11-12 (Live `kogane-e7f2b` Firestore Verification & Hermetic `.env.test`)

- **Context & Direction Check**: Verified live Cloud Firestore provisioning (`kogane-e7f2b`, `asia-southeast1`) against the Firebase Spark workaround. No scope redirection introduced.
- **Changes Made**:
  1. **Hermetic Test Isolation (`.env.test`)**: Added `.env.test` clearing Firebase/Supabase runtime credentials during `bun test` (`NODE_ENV=test`, `DEV_MODE=true`, `DB_PROVIDER=sqlite`, empty `STORAGE_PROVIDER` / `FIREBASE_SERVICE_ACCOUNT_JSON`) so having live production `.env` values locally never causes `bun test` to write test records into live `kogane-e7f2b` Cloud Firestore.
  2. **Local Live Firebase `.env` Setup**: Configured local gitignored `.env` (`DEV_MODE=false`, `DB_PROVIDER=firebase`, `STORAGE_PROVIDER=firestore`, `FIREBASE_PROJECT_ID=kogane-e7f2b`, `FIREBASE_REGION=asia-southeast1`, random `SESSION_SECRET` / `ENCRYPTION_KEY`, and base64-encoded service account JSON) and cleaned temporary test probe collections from Firestore.
- **Verification Executed**:
  - **Live Cloud Firestore + `FirestoreStorageAdapter` Smoke Test (`kogane-e7f2b`, `asia-southeast1`)**: Verified real `db.insert`, `db.queryOne`, `db.delete`, `FirestoreStorageAdapter.upload`, `read`, and `delete` roundtrip (`bytesMatched: true`, `/api/storage/files/public/assets/live_smoke_logo.png`), with all temporary collections cleaned up (`remainingCollections: []`).
  - `bun test` (with `.env.test` overriding live `.env`): **173 pass, 0 fail** (1,272 assertions across 18 files).
- **Remaining Recommendations**:
  1. Run `bun run start` locally (plus `bun run tunnel` for remote mobile/tablet HTTPS + QR) or deploy via `render.yaml` / `Dockerfile` to exercise browser signup, 2FA QR enrollment, and logo upload against live `kogane-e7f2b` Firestore.
