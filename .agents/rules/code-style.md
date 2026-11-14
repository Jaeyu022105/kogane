# Kogane Code Style & Coding Standards

This guide defines the code style rules, TypeScript and Vue 3 conventions, UI/CSS design tokens, security practices, and localization standards for the **Kogane** codebase.

---

## 1. TypeScript & Control Flow Conventions

### Strict Typing & Narrowing

- **Prefer `unknown` Over `any`**: Never introduce untyped `any` to silence compiler diagnostics. Accept `unknown` at external boundaries (request bodies, JSON columns, query parameters) and narrow values explicitly with type guards:
  ```ts
  export function parseAuditJson<T = unknown>(value: unknown): T | null {
    if (value === null || value === undefined) {
      return null;
    }

    if (typeof value === 'object') {
      return value as T;
    }

    if (typeof value !== 'string' || !value.trim()) {
      return null;
    }

    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }
  ```
- **Centralize Shared UI & Domain Types**: Shared layout, element, theme, and event contracts belong in `lib/uiTypes.ts`. Domain-specific contracts belong at the top of their owning module in `lib/*.ts`.

### Guard Clauses & Early Returns

- **Keep Control Flow Flat**: Use guard clauses at the top of functions and API handlers to handle invalid states, missing sessions, or permission denials immediately instead of nesting `if / else` blocks:
  ```ts
  if (!businessId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing business ID' });
  }

  if (!canAccessTerminal(session, terminal)) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' });
  }
  ```
- **Explicit Braces**: Use braced multiline blocks for conditionals and loops in TypeScript and Vue script blocks to keep diffs clean and unambiguous.

### Statement Groups & Vertical Spacing

- **Separate Context Changes**: Place one blank line between distinct statement groups:
  1. Imports (external packages first, then `~/lib/*`, `~/composables/*`, `~/server/utils/*`)
  2. Type/interface declarations and module-level constants
  3. Local variable/state declarations (`ref`, `computed`, `const`)
  4. Guard clauses (`if (!valid) return;`)
  5. Core operational or async calls
  6. Final `return` statement
- **Template Literals for String Construction**: Always use JavaScript template literals (`` `${origin}/t/${slug}` ``) rather than `+` string concatenation when formatting dynamic strings. For terminal runtime expressions (`{{row.price}}`), use the dedicated interpolation helpers in `lib/runtime.ts`.

---

## 2. Vue 3 SFC & Nuxt 3 Conventions

### Component Structure (`<script setup lang="ts">`)

- **Composition API Only**: Use `<script setup lang="ts">` across all `pages/**/*.vue`, `components/**/*.vue`, and `layouts/**/*.vue` files. Do not use the Options API.
- **Explicit Button Types**: Every `<button>` element in a Vue template **must** specify `type="button"` or `type="submit"` explicitly so buttons inside forms never trigger accidental page reloads:
  ```vue
  <button type="button" class="btn-primary btn-ribbon" @click="openPresetModal">
    Apply Preset
  </button>
  ```
- **Semantic Landmarks & Heading Hierarchy**:
  - Every page must render a primary `<main>` landmark.
  - Every page must contain **exactly one `<h1>`** describing the page's primary purpose.
  - Section and card headings must follow strict sequential order (`h1 -> h2 -> h3`) without skipping levels (e.g., never place an `<h3>` card title inside a section that lacks an `<h2>` heading).
- **Dashboard Viewport & Mobile Layout**:
  - Respect `.dashboard-viewport-lock` and `.dashboard-mobile-header` responsive rules in `assets/css/tailwind.css` so sidebar scrolling (`layouts/dashboard.vue`) and mobile headers work cleanly across tablet and phone viewports.

### SEO & Head Metadata (`composables/useSeo.ts`)

- Use `usePageSeo()` in page components to configure title, description, OpenGraph, Twitter Card, and JSON-LD structured data.
- **Canonical vs. Noindex Rule**: When `noindex: true` is passed to `usePageSeo()`, omit `<link rel="canonical">` (`link: []`) so crawlers never receive conflicting canonical + noindex signals. Ensure non-public routes (`/dashboard`, `/terminal`, `/t/`, `/login`, `/signup`, `/api/`) are listed in `NOINDEX_PREFIXES` in `server/middleware/seoHeaders.ts`.

---

## 3. UI Design System & Additive Preservation Standards

### Additive UI Invariant

> [!IMPORTANT]
> **Support & Extend What We Have**: Never remove, strip, or replace existing UI sections, early-version components, or visual motifs unless the user explicitly asks to remove them. Always add new capabilities alongside established elements.

### Signature "Neapolitan Ice Cream" Palette & Tokens

All public marketing pages (`assets/css/marketing.css`), dashboard views (`assets/css/tailwind.css`), and Tailwind utilities (`tailwind.config.ts`) share Kogane's Neapolitan palette:

| Role | Color Name | Hex / Value | CSS Variables & Tailwind Tokens |
| :--- | :--- | :--- | :--- |
| Primary Ink & Dark Surface | **Chocolate Maroon** | `#68293A` (deep `#4A1A27` / `#4d1e2b`) | `--k-dark`, `--k-ink`, `--shell-sidebar`, `text-dark`, `bg-dark`, `marketing-ink` |
| Brand Accent & Highlights | **Strawberry Pink** | `#FF5776` (hover `#E84362`, soft `#FFEBEF`) | `--k-accent`, `--shell-pink`, `brand-pink`, `marketing-accent`, `.btn-pink` |
| Primary Warm Surface | **Vanilla Cream** | `#F6E6D7` (page bg `#FFFDFB`, alt `#FBF4ED`) | `--k-cream`, `--k-bg`, `--k-surface-alt`, `bg-bg1`, `marketing-cream` |
| Secondary Border & Tint | **Blush** | `#E3C7B9` | `--k-blush`, `bg-bg1-dark`, `marketing-blush`, `marketing-border` |

### Typography

- **Headings & Wordmark (`DM Serif Display`)**: Use `var(--k-font-serif)` / `font-serif` (`.m-heading`, `.m-heading-lg`, `.m-heading-md`) for editorial headings and the Kogane wordmark.
- **UI Controls & Body Copy (`Inter`)**: Use `var(--k-font-sans)` / `font-sans` for buttons, form inputs, tables, and body paragraphs.
- **Identifiers & Metrics (`JetBrains Mono`)**: Use `var(--k-font-mono)` / `font-mono` with `font-variant-numeric: tabular-nums` (`.m-tabular`, `.m-mono`) for terminal IDs, share slugs, timestamps, prices, and audit counters.

### Hanging Bookmark Ribbon Buttons (`.ribbon` & `.btn-ribbon`)

- **Marketing & Public Pages**: Primary CTA buttons must include the `.ribbon` modifier class (`.m-btn-primary.ribbon`, `.m-btn-dark.ribbon`, `.m-btn-light.ribbon`) defined in `assets/css/marketing.css`.
- **Dashboard, Builder & Auth Pages**: Primary action and submit buttons must include the `.btn-ribbon` modifier class (`.btn-primary.btn-ribbon`, `.btn-pink.btn-ribbon`) defined in `assets/css/tailwind.css`.
- **Never Remove Ribbon Bookmarks**: Both `.ribbon::after` and `.btn-ribbon::after` render Kogane's signature hanging notched bookmark tail (`clip-path: polygon(0 0, 100% 0, 100% 100%, 50% 52%, 0 100%)`). Preserve them across all primary CTAs.

### Copywriting & Tone

- **Practical Business Language**: Write concise, direct copy aimed at store owners, cashiers, kitchen staff, and stockroom managers. Avoid developer jargon (`DDL`, `schema`, `ORM`, `hydration`) and avoid generic AI filler text.

---

## 4. Naming Conventions & Identifiers

- **Do Not Abbreviate Identifiers**: Write out variable, function, parameter, composable, and interface names clearly:
  - Write `terminalPermissionPreset` instead of `termPermPres`
  - Write `businessId` instead of `bizId`
  - Write `previousStatus` instead of `prevStat`
  - Write `definitions` instead of `defs`
  - Write `configuration` instead of `cfg`
- **Permitted Standard Abbreviations**:
  - Web & platform standards: `id`, `db`, `sql`, `ui`, `ux`, `seo`, `ssr`, `sse`, `api`, `url`, `uri`, `html`, `css`, `json`, `csv`, `xlsx`, `svg`, `png`, `ip`, `ttl`
  - Security & auth standards: `pin`, `qr`, `totp`, `hmac`, `sha`, `csrf`, `xss`, `sqli`, `2fa`
  - Domain standards: `pos` (Point of Sale), `kds` (Kitchen Display System), `pwd` (Person with Disability discount), `vat` (Value-Added Tax), `i18n`, `a11y`
- **Casing Rules**:
  - `PascalCase`: Vue components (`TerminalCard.vue`, `CartWidgetEl.vue`) and TypeScript `interface` / `type` names (`TerminalPermissionPreset`, `UILayout`).
  - `camelCase`: Functions, variables, composables (`useCanvasRuntime`, `useRealtimeSync`), and object properties.
  - `UPPER_SNAKE_CASE`: Module-level constants (`ALL_TERMINAL_PERMISSION_PRESETS`, `NOINDEX_PREFIXES`, `SUPPORTED_LOCALES`).
  - `kebab-case`: Preset keys (`cashier-register`, `kitchen-display`), URL slugs, and CSS class names (`.m-btn-primary`, `.pillar-card`).

---

## 5. Database, Security & Localization Standards

- **Parameterized Queries & Identifier Validation**:
  - Always use parameterized placeholders (`?` in SQLite, SDK filters in Supabase/Firestore) for values.
  - Always validate dynamic table and column identifiers through `validateIdentifier()` in `lib/sql.ts` before constructing queries.
  - Sanitize incoming row records and string payloads with `lib/security.ts` (`sanitizeRecord`, payload size limits).
- **6-Locale Synchronization (`locales/*.json`)**:
  - Kogane supports 6 locales: `en`, `ph`, `es`, `ja`, `ko`, and `zh` (with legacy `fil` normalized to `ph` in `composables/useLocale.ts`).
  - Every user-facing translation key added or updated in `locales/en.json` must be added to `ph.json`, `es.json`, `ja.json`, `ko.json`, and `zh.json` in the same checkpoint.

---

## 6. File Size, Comments & Encoding

- **1,000-Line Hard Limit**: No `.ts`, `.vue`, or `.css` file may exceed 1,000 lines. Extract cohesive helpers into `lib/*.ts`, `server/utils/*.ts`, or child components before a file grows unwieldy.
- **Clean, Concise Comments**:
  - Do not add decorative ASCII divider banners (`// -----`, `// =====`, `// ─────`) or sequential numbered comments (`// 1.`, `// 2.`).
  - Use concise single-line comments (`// ...`) or standard TypeScript docblocks (`/** ... */`) only where intent or non-obvious invariants need explanation.
- **UTF-8 Everywhere**: Always read and write source files, Vue templates, and `locales/*.json` dictionaries as clean UTF-8 without mojibake or corrupted characters.
