# Kogane Handoff

This is the living handoff for future AI sessions and future maintainers. Read this file first, then `DESIGN-DOCUMENT.md`, then `README.md`, then inspect only the files needed for the current task.

After every meaningful prompt or implementation pass, update this file with:

- What changed.
- Why it changed.
- Files touched.
- What still needs work.
- Any risks, assumptions, or verification results.

## Current Project Identity

The project is now called Kogane. The older name was Postfolio. Old context documents may still mention Postfolio, but new UI, docs, and copy should use Kogane unless referring to historical origin.

Kogane is a preset-driven internal tool builder for SMEs. It creates database tables and role-based terminal UIs for workflows such as cashier, catalog registrar, inventory, kitchen display, and reports.

## Context Sources Used

Temporary context folders were reviewed for this handoff:

- The first context described the original Postfolio charter.
- The second context described the Kogane initiation update.
- The third context contained WBS/OBS style project management content.
- The fourth context contained estimating and budget/schedule context.

Those folders are temporary and can be deleted. The durable project context should now live in:

- `DESIGN-DOCUMENT.md`
- `HANDOFF.md`
- `README.md`
- The source code itself

## Current App State

Current implemented or partially implemented areas:

- Kogane rebrand is present in app identity and package metadata.
- Localization supports `en`, `ph`, `es`, `ja`, `ko`, and `zh`; legacy `fil` should map to `ph`.
- Marketing pages exist for home, features, pricing, terms, and privacy.
- Login/get-started supports locale detection and dev-mode auth.
- Onboarding creates a business, feature tables, starter terminals, branded layouts, and terminal layout variants.
- Dashboard includes overview, database, builder, terminals, audit, reports, and settings.
- Terminal management supports create, delete, thumbnails, copy link, copy PIN, options/detail pages, public slugs, and terminal layout editing.
- UI Builder supports canvas editing, terminal theme editing, station objects, generic widgets, color customization, layout presets, and saving layouts.
- Staff terminals render private routes through `/terminal/[id]` and public/shared routes through `/t/[slug]`.
- Cashier supports table number, cart, payment method metadata, simulated/bridge-ready card reader flow, and receipt printing.
- Catalog registrar supports product entry and catalog viewing.
- Inventory manager supports stock views, receiving-oriented layouts, upload tools, and charts.
- Kitchen display can view incoming orders with refresh, but status mutation is still a key missing feature.
- Reports viewer supports audit/activity tables and charts.

## Architecture Notes

Main stack:

- Nuxt 3 and Vue 3
- Bun runtime
- Tailwind CSS plus custom CSS
- SQLite in development through `bun:sqlite`
- Supabase/PostgreSQL path for production

Important files:

- `README.md`: high-level project overview, though some text may have encoding artifacts and may lag behind code details.
- `lib/db.ts`: database adapter switch based on `DEV_MODE`.
- `lib/db-sqlite.ts`: local SQLite adapter; creates `dev.db`.
- `lib/uiTypes.ts`: shared layout, element, theme, and runtime event types.
- `lib/builderPresets.ts`: starter terminal layouts.
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

## Data Model Notes

Platform tables:

- `businesses`
- `terminals`
- `presets`
- `audit_log`

Starter business tables:

- `products`
- `orders`
- `inventory`

Important order fields:

- `items`
- `line_items`
- `total`
- `status`
- `table_number`
- `staff_name`
- `payment_method`
- `payment_status`
- `payment_reference`
- `receipt_number`

In local dev mode, business tables are represented with prefixed names in SQLite using the business schema name.

## Design Direction

The UI should feel like a polished daily operations tool, not a raw developer console.

Current design language:

- Warm cream and maroon base identity.
- Compact cards and panels with restrained rounded corners.
- Premium but practical admin surfaces.
- Staff terminals should be high contrast, readable, and task-focused.
- Layout bundles should keep generated terminals visually consistent.
- Individual widgets can still be customized for variety.

Avoid drifting back into developer-first language unless the page is truly for builders or maintainers.

## Recent Documentation Pass

This pass created:

- `DESIGN-DOCUMENT.md`
- `HANDOFF.md`

Why:

- The team was asked to document the website, UI style, features, goals, planned features, and project context.
- Future AI sessions should be cheaper and faster by reading handoff context before searching the full codebase.
- Temporary context folders can be deleted after this because the important project story has been folded into durable Markdown files.

Files touched:

- `DESIGN-DOCUMENT.md`
- `HANDOFF.md`

Verification:

- Documentation files were created in the project root.
- No app code was changed in this pass.

## Known Gaps And Next Work

High priority:

- Add kitchen order status controls so authorized terminals can move orders from `pending` to `fulfilled`.
- Decide whether kitchen should remain read-only by default or use a new permission preset with update access only on `orders.status`.
- Clean text encoding artifacts visible in README and some Vue comments/labels.
- Confirm whether `locales/fil.json` should be removed after all legacy references are safely migrated to `ph`.
- Verify that `scripts/seed-presets.ts` deletion is intentional, because `package.json` still has `seed:presets`.

Medium priority:

- Improve onboarding wording for non-technical business owners.
- Add preview thumbnails to layout-bundle selection if time allows.
- Add clearer terminal style previews in onboarding.
- Add more station objects for registrar, inventory, kitchen, and reports.
- Add receipt template controls and optional receipt logo.
- Add real provider-specific card reader bridge later.

Testing to run after app code changes:

- `bun run build`
- Manual browser check for onboarding, terminal creation, builder save, cashier submit, catalog product entry, and kitchen display.
- If Bun is unavailable on PATH, use the installed Bun path or Nuxt's Node entry only for build checks.

## Current Git Caveats

At the time this handoff was created, the worktree already had unrelated dirty state:

- `.devserver.out.log` modified.
- `scripts/seed-presets.ts` deleted.
- Temporary `context` folders were untracked and intended to be deleted by the user.

Do not restore or revert those unless the user explicitly asks.

## Operating Guidance For Future AI

- Start by reading `HANDOFF.md`, then `DESIGN-DOCUMENT.md`, then `README.md`.
- Treat historical PDFs or context folders as background only.
- Prefer current code over old assignment documents when there is a conflict.
- Keep Kogane simple for daily users.
- Update this handoff after every meaningful prompt.
- Include why a feature was built, not only what files changed.
