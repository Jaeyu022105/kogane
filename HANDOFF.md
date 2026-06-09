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
- **No paid cloud infrastructure.** The local dev environment uses SQLite via Bun. Production targets free-tier Supabase/PostgreSQL. Do not provision paid services without explicit instruction.
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

- Nuxt 3 and Vue 3
- Bun runtime
- Tailwind CSS plus custom CSS
- SQLite in development via `bun:sqlite`
- Supabase/PostgreSQL intended for production

Important files:

- `README.md`: high-level project overview. Some text may have encoding artifacts and may lag behind code.
- `lib/db.ts`: database adapter switch based on `DEV_MODE`.
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
- Documentation was reviewed for consistency with the current codebase.

---

## Known Gaps & What Needs Work

### Critical / Blocking

- **Kitchen order status controls are missing.** The Kitchen Display preset is currently read-only. There is no way for kitchen staff to move an order from `pending` → `preparing` → `fulfilled`. The data model has the `status` field but the terminal UI and the server-side event handler do not expose a mutation action for it. This needs a new station object (or a configurable button widget) with an `UPDATE orders SET status = ? WHERE id = ?` event bound to it, plus a matching permission preset that allows kitchen terminals to update `orders.status` only.
- **`seed:presets` script is missing.** `package.json` still has a `seed:presets` npm script but `scripts/seed-presets.ts` has been deleted. Either restore the script or remove the npm script entry to avoid confusion.
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

- `scripts/seed-presets.ts` was deleted but `package.json` still references `seed:presets`.
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
