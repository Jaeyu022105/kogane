# Kogane Design Document

## 1. Product Summary

Kogane is a preset-driven internal tool builder for small and medium businesses. It helps an owner or admin create business workstations such as cashier registers, product catalog desks, inventory boards, kitchen displays, and reporting consoles without manually building a frontend for each staff role.

The project began as Postfolio, a schema-driven internal tool builder, and has since been rebranded and simplified into Kogane. The current direction is less developer-facing and more daily-user friendly: admins choose a business type, select features, pick a visual style, and Kogane generates the database tables and starter terminal interfaces for them.

## 2. Product Goal

The goal is to let a business owner launch practical internal tools quickly:

- Define or generate the business data structure.
- Create role-specific terminals for staff.
- Customize each terminal visually.
- Use terminals through shareable links or locked PIN access.
- Track activity, reports, and business operations from one admin dashboard.

Kogane should feel approachable to non-developers while still keeping enough technical depth for schema editing, terminal customization, and future integrations.

## 3. Target Users

- Small business owners who need simple internal software but do not want to build a custom app.
- Staff members using focused terminals for cashier, inventory, kitchen, catalog entry, or reporting.
- Student developers and project reviewers who need to understand how schema, UI, and terminal access connect.
- Future maintainers or AI coding agents who need enough context to continue the project without rereading every file.

## 4. Core Website And App Areas

### Marketing Website

The public website explains Kogane, shows the value of preset workstations, and gives users a path into the app. It includes the homepage, features page, pricing page, privacy page, and terms page.

The homepage should show a dashboard entry point when a user is already logged in.

### Login And Get Started

The login page doubles as the get-started entry. In development mode, admin authentication is intentionally simplified so the team can test quickly. The page supports localization and shows translated helper text based on the active or detected locale.

### Onboarding

The onboarding modal creates the workspace. It asks for:

- Business name and type.
- Business logo.
- Language preference.
- Feature preset and individual features.
- UI layout bundle.
- Terminal layout variants.
- Element shape style.
- Ambient effect.

Onboarding should create both the database tables and the starter terminal UI layouts. This is important because the target user should not have to understand table setup before seeing a useful workstation.

### Dashboard

The dashboard is the admin control center. It contains:

- Overview page for common admin actions.
- Database page for table and record management.
- UI Builder for terminal layouts.
- Terminal management for creating, editing, linking, and deleting terminals.
- Audit log for workspace activity.
- Reports for operational summaries.
- Settings for business branding, logo, colors, and re-running onboarding.

The dashboard should also provide a clear path back to the homepage.

### Terminal Runtime

Terminals are staff-facing workstations. They can be opened through:

- Private terminal route: `/terminal/[id]`
- Public link route: `/t/[slug]`

Terminals use PIN-based access where appropriate. Public links are useful when employees should access only the terminal screen and should not be able to backtrack into admin setup.

## 5. Current Feature Set

### Schema And Database

Kogane supports a hybrid database strategy:

- `DEV_MODE=true` uses local SQLite through Bun's built-in SQLite adapter.
- Production mode is intended to use Supabase/PostgreSQL.
- Platform tables include businesses, terminals, presets, and audit log.
- Business tables are created per business schema.
- Starter tables include products, orders, and inventory.

### UI Builder

The UI Builder is a canvas-based editor for terminal layouts. It supports:

- Selecting a terminal and editing its layout.
- Adding generic elements like text, buttons, images, inputs, tables, charts, upload controls, cart widgets, and scan fields.
- Adding station objects that are closer to real business workflows.
- Editing colors, radius, table sources, chart sources, payment behavior, receipt settings, and event bindings.
- Applying presets and saving the resulting layout to the terminal.
- Previewing a terminal-like shell inside the builder.

### Role-Based Terminals

Current terminal presets include:

- Cashier Register
- Catalog Registrar
- Inventory Manager
- Kitchen Display
- Reports Viewer

Each preset has different recommended widgets and permission defaults. For example, a cashier can insert orders, a catalog registrar can maintain products, and a reports viewer can read audit/reporting data.

### Cashier Workflow

The cashier station currently supports:

- Product picker.
- Table number input.
- Cart total.
- Payment methods such as cash, card, and GCash.
- Simulated or bridge-ready card reader support.
- Receipt metadata.
- Browser print support for receipts.
- Saving orders with `pending` status.

Hardware support is intentionally support-ready rather than vendor-specific. A real card reader still needs a provider SDK or local bridge later.

### Catalog And Inventory

The catalog registrar is intended for product entry and product lookup. The inventory manager is intended for stock views, receiving, uploads, and inventory charts.

### Kitchen Display

The kitchen display watches incoming orders with auto-refresh. It is currently primarily read-only. A planned improvement is allowing authorized kitchen staff to change order status from `pending` to `fulfilled`.

### Audit And Reports

Kogane records workspace activity in an audit log and supports report pages and chart/table widgets that can read business data or audit-log data.

### Localization

Supported locale codes are:

- `en`
- `ph`
- `es`
- `ja`
- `ko`
- `zh`

Legacy `fil` values should map to `ph`.

## 6. UI Style Direction

Kogane should feel like a calm, premium operations tool rather than a technical admin panel. The visual direction is warm, polished, and practical.

### General Style

- Warm cream and maroon are the original base identity.
- Later layout bundles can shift the palette while preserving the same product structure.
- Cards should stay compact, readable, and useful.
- Controls should favor direct action over abstract technical wording.
- Admin pages should be dense enough for repeated use but not intimidating.
- Terminal screens should be high contrast, fast to scan, and friendly for staff.

### Layout Bundles

Kogane supports layout bundles so generated terminals can look consistent:

- Aurora Service: warm hospitality style for customer-facing operations.
- Ink Studio: sharper operator-first style for busy workstations.
- Paper Ledger: lighter editorial style for guided workflows and office-like screens.

Each bundle affects theme colors, terminal background, panel surfaces, and widget defaults.

### Branding

Business branding should flow from the logo and selected palette into generated layouts:

- Business logo can be uploaded during onboarding or settings.
- Palette extraction can derive colors from the logo.
- Admins can manually adjust colors afterward.
- Terminal layouts should inherit brand colors unless a widget is intentionally customized.

### Element Styling

Element style options currently include:

- Rounded or square surfaces.
- No ambient effect, floating orbs, or soft grid.
- Widget-level colors for tables, charts, buttons, cart widgets, inputs, uploads, and terminal theme.

Future concepts from the UI/design lead can add more style controls, but they should remain understandable to a non-technical owner.

## 7. Planned Features And Improvements

High-priority planned work:

- Add kitchen order status controls for `pending`, `preparing`, `fulfilled`, and possibly `served`.
- Make terminal workflow objects more complete for each business type.
- Improve localization completeness and fix any text encoding artifacts.
- Improve onboarding copy so it avoids developer terms like schema, DDL, and runtime when speaking to daily users.
- Add better first-run sample data for demos.
- Add clearer visual previews when choosing terminal layout variants.

Medium-priority planned work:

- Add vendor-specific card reader integration through a provider SDK or local bridge.
- Add receipt templates and receipt logo controls.
- Add richer role permissions per table instead of relying mostly on wildcard presets.
- Add more chart presets and report templates.
- Add stronger real-time sync if the final deployment needs true multi-device live updates.

Out of scope for the current academic build:

- Native iOS or Android apps.
- Full payment gateway processing.
- Paid cloud infrastructure.
- Enterprise-grade hardware integrations.
- Complex marketplace or plugin systems.

## 8. Technical Architecture

Main stack:

- Nuxt 3
- Vue 3 Composition API
- Bun runtime
- Tailwind CSS and custom CSS
- SQLite for local development
- Supabase/PostgreSQL path for production

Important modules:

- `lib/uiTypes.ts` defines layout, elements, theme, and event types.
- `lib/builderPresets.ts` defines starter layouts.
- `lib/stationObjects.ts` defines reusable workstation objects.
- `lib/starterWorkstations.ts` defines terminal layout variants.
- `lib/workspaceBranding.ts` applies business colors and layout bundle styling.
- `lib/permissions.ts` defines terminal permission presets.
- `server/utils/managedTerminals.ts` creates branded starter terminals.
- `server/utils/starterTables.ts` creates starter business tables.
- `components/OnboardingModal.vue` controls the onboarding experience.
- `pages/dashboard/builder.vue` controls the builder workspace.
- `pages/dashboard/terminals/index.vue` controls terminal management.
- `pages/terminal/[id].vue` and `pages/t/[slug].vue` render staff terminals.

## 9. Design Principles

- Start from useful presets, then allow customization.
- Keep business-owner language simple.
- Make terminals focused and hard to misuse.
- Keep admin power behind the dashboard.
- Make generated UI feel intentional, not like raw database forms.
- Keep local SQLite and production Supabase paths aligned where possible.
- Document decisions in `HANDOFF.md` after meaningful prompts so future AI agents can continue without re-discovering the project.
