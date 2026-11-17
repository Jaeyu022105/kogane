# Kogane Architectural Code Review & Audit Guide

Before landing any substantial feature, refactor, UI update, or backend endpoint, the change must pass an architectural audit from the perspective of an uncompromising architect who demands **SOLID principles**, **dead-simple readability**, **additive UI preservation**, and **zero tolerance for over-engineering or tangled spaghetti**.

---

## 1. The Core Philosophy

1. **Simplicity Over Cleverness**: Code must read naturally and express intent directly. If a developer cannot understand a composable, API handler, or domain helper in 10 seconds, simplify it.
2. **Support & Extend What We Have (Additive Evolution)**: Never delete, strip, or replace established UI sections, early-version visual elements, or Kogane's signature **Neapolitan ice cream aesthetic** (`#68293A` chocolate maroon, `#FF5776` strawberry pink, `#F6E6D7` vanilla cream, `#E3C7B9` blush, `DM Serif Display` headings, and `.ribbon` / `.btn-ribbon` hanging bookmark buttons) unless explicitly instructed by the user.
3. **SOLID Principles Across Nuxt 3, Vue 3 & Nitro**: Modular, decoupled layers keep pure business logic testable in `bun test` without requiring a running browser or cloud database.
4. **No Over-Engineering**: Keep Kogane a fast, dependable SaaS Terminal Builder for everyday businesses. Do not introduce heavy enterprise abstractions or speculative frameworks.
5. **Ruthless Maintainability**: Every line of code added is a maintenance obligation. Write focused, well-typed modules with clear boundaries.

---

## 2. SOLID Review Criteria

### S — Single Responsibility Principle (SRP)

- **One Job Per Module / Component**: Does each file have one clear reason to change?
- **Strict Layer Separation**:
  - **Pure Domain Logic (`lib/*.ts`)**: Keep calculations, permission checks (`lib/permissions.ts`), discount math (`lib/discounts.ts`), currency formatting (`lib/currency.ts`), runtime expression interpolation (`lib/runtime.ts`), audit formatting (`lib/audit.ts`), and preset definitions (`lib/builderPresets.ts`, `lib/starterWorkstations.ts`) pure and framework-free so they can be unit-tested directly under `bun test`.
  - **Reactive Client State (`composables/use*.ts`)**: Keep Vue state orchestration, SSE subscriptions (`useRealtimeSync.ts`), SEO head injection (`useSeo.ts`), and canvas state (`useCanvas.ts`, `useCanvasRuntime.ts`) in composables rather than bloating page templates.
  - **Server Utilities (`server/utils/*.ts`)**: Keep reusable backend orchestration (audit recording, managed terminal sync, reporting aggregations, spreadsheet generation, SSE broadcasting) in `server/utils/`.
  - **API Route Handlers (`server/api/**`)**: Keep route handlers thin—parse and validate input, verify session/permissions, invoke `lib/` or `server/utils/` functions, record audit logs, and return typed responses.
- **File Size Gate**: Keep files compact and modular. Any file approaching the **1,000-line hard limit** must be split into focused modules before landing.

### O — Open/Closed Principle (OCP)

- **Data-Driven Presets & Workstations**: New terminal roles, industry presets, or layout bundles should be added via declarative registries (`lib/builderPresets.ts`, `lib/starterWorkstations.ts`, `lib/stationObjects.ts`, `lib/permissions.ts`, `lib/workspaceBranding.ts`) without rewriting core builder or runtime loops.
- **Extensible Canvas Elements**: Each `UIElement` type (`text`, `button`, `input`, `scan`, `table`, `chart`, `cart`, `image`, `upload`) maps cleanly through `components/ElementRenderer.vue` to its dedicated component in `components/elements/*El.vue`.
- **Additive UI Upgrades**: Enhance marketing, auth, and dashboard pages by adding new sections or interactive previews while preserving existing cards, classes, and visual motifs.

### L — Liskov Substitution Principle (LSP)

- **Database Substitutability**: `SqliteAdapter` (`lib/db-sqlite.ts`) and `FirestoreAdapter` (`lib/db-firebase.ts`) must honor the exact same `DbAdapter` contract (`lib/db.ts`)—returning identical shapes, handling missing records consistently, and enforcing parameter safety on both backends. Route code must not branch on the active provider; put any unavoidable difference in a `server/utils` data-access helper (see `server/utils/auditLogQuery.ts`).
- **Storage Provider Parity**: Local filesystem, Firebase Cloud Storage, and Firestore inline Spark-mode storage must behave interchangeably behind `lib/storage.ts`.
- **Preset Role Alias Resolution**: `presetByRoleOrKey()` (`lib/permissions.ts`) must deterministically resolve both canonical preset keys (e.g. `kitchen-display`) and role aliases (e.g. `kitchen-station`) without silent fallbacks to unrelated permissions.

### I — Interface Segregation Principle (ISP)

- **Focused TypeScript Contracts**: Keep interfaces in `lib/uiTypes.ts` and domain modules cohesive and specific. Avoid forcing components or helpers to accept bloated parent objects when they only need a narrow slice (`UIElement`, `TerminalPermissionSet`, `AuditLogEntry`).
- **Narrow Function Signatures**: Pure helpers in `lib/*.ts` should accept explicit typed arguments (`(value: unknown)`, `(amount: number, currencyCode: string)`) rather than raw H3 `H3Event` objects or full reactive stores.

### D — Dependency Inversion Principle (DIP)

- **Depend on Adapters, Not Concrete Cloud SDKs**: Server routes and utilities must access persistence through `getDb()` (`lib/db.ts`) and `getStorage()` (`lib/storage.ts`), never by importing `bun:sqlite` or `firebase-admin` directly inside route handlers.
- **Lazy Cloud SDK Initialization**: Cloud adapters (`lib/db-firebase.ts`, `lib/firebaseAdmin.ts`, `lib/storage.ts`) must lazy-load external SDKs only when that provider is active so local development and unit tests run with zero external credentials.

---

## 3. Simplicity, Readability & UI Preservation Audit

During every code review, interrogate the diff with these questions:

- **Were all existing UI elements and the Neapolitan design style preserved?**
  - Check that `#68293A` (chocolate maroon), `#FF5776` (strawberry pink), `#F6E6D7` (vanilla cream), and `#E3C7B9` (blush) remain the foundational palette.
  - Check that `.ribbon` on marketing primary CTAs (`.m-btn-primary.ribbon`) and `.btn-ribbon` on dashboard/auth primary buttons (`.btn-primary.btn-ribbon`) are intact.
  - Check that no existing sections (`.preview-card`, `.industry-chip`, `.pillar-card`, `.philosophy-badges`, `.station-card`, `.module-section`, `.extra-card`, `.m-cta-strip`, `.login-blob`) were deleted or stripped.
- **Is identifier naming painfully obvious?**
  - Do function, variable, composable, and prop names state exactly what they represent (`syncManagedPresetTerminals`, `parseAuditJson`, `resolveRuntimeTemplate`, `validateIdentifier`)?
  - Reject arbitrary contractions (`defs`, `idx`, `tmp`, `cfg`, `pres`).
- **Are comments clean and devoid of AI slop?**
  - Reject multi-line decorative ASCII divider banners (`// -----`, `// =====`, `// ─────`) and numbered comment sequences (`// 1.`, `// 2.`). Keep comments concise and single-line, explaining *why* rather than restating the code.
- **Is user-facing copy practical, business-friendly, and localized across all 6 locales?**
  - Reject filler marketing fluff or raw developer jargon (`DDL`, `ORM`, `hydration`).
  - Confirm that any new translation key added to `locales/en.json` is also present in `locales/ph.json`, `locales/es.json`, `locales/ja.json`, `locales/ko.json`, and `locales/zh.json`.
- **Is the control flow flat with early guard clauses?**
  ```ts
  // Good: Flat guard clauses with immediate exit
  if (!session?.businessId) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
  }

  if (!hasTablePermission(terminal.permissions, tableName, 'insert')) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' });
  }

  return await insertBusinessRow(session.businessId, tableName, payload);
  ```
- **Are HTML semantics, accessibility, and SEO invariants satisfied?**
  - Every page has a `<main>` landmark, a single `<h1>`, and strictly sequential heading order (`h1 -> h2 -> h3`).
  - Every non-submit `<button>` explicitly declares `type="button"`.
  - `usePageSeo()` omits `<link rel="canonical">` when `noindex: true`, and `server/middleware/seoHeaders.ts` sets `X-Robots-Tag: noindex, nofollow` on non-public paths.

---

## 4. Architectural Audit Checklist

Before committing any feature, bug fix, or refactor, verify every item below:

- [ ] **Additive UI Preservation**: Existing UI sections, classes, and the Neapolitan palette (`#68293A`, `#FF5776`, `#F6E6D7`, `#E3C7B9`) + `.ribbon` / `.btn-ribbon` hanging bookmark buttons are preserved intact.
- [ ] **SRP & Layering**: Pure logic lives in `lib/`, reactive UI state in `composables/`, server helpers in `server/utils/`, and thin HTTP handlers in `server/api/`.
- [ ] **Database & Storage Parity**: Queries work on both the SQLite and Firestore adapters via `lib/db.ts` without hardcoded provider assumptions.
- [ ] **Managed Preset Sync**: Changes to preset structures remain compatible with `managed_preset_key` propagation (`/api/presets/sync` and `server/utils/managedTerminals.ts`).
- [ ] **Security & Permissions**: SQL identifiers are validated via `lib/sql.ts`, inputs are sanitized via `lib/security.ts`, and terminal role permissions are enforced via `lib/permissions.ts`.
- [ ] **Audit Logging**: State-mutating endpoints record structured entries via `recordAuditLog()` (`server/utils/audit.ts`).
- [ ] **Strict TypeScript**: `bunx nuxi typecheck` (or `vue-tsc --noEmit`) passes with 0 errors and no unsafe `any` casts (`unknown` narrowed properly).
- [ ] **Semantic HTML & A11y**: Single `<h1>`, sequential `h1 -> h2 -> h3` headings, `<main>` landmark, and explicit `type="button"` / `type="submit"` on all `<button>` elements.
- [ ] **6-Locale Parity**: All user-facing strings are synchronized across `en.json`, `ph.json`, `es.json`, `ja.json`, `ko.json`, and `zh.json`.
- [ ] **File Size & Cleanliness**: Every file is under 1,000 lines, free of ASCII banner comments, and verified with `bun test` and `bun run build`.
