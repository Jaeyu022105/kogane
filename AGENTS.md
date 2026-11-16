# Kogane Developer & Agent Guide

Welcome to the **Kogane** codebase. Kogane is a lightweight, practical SaaS Terminal Builder for businesses where UI presets are configured once and **1 platform improvement updates every connected terminal automatically**. This guide outlines core operating invariants, product architecture, design preservation mandates, and pointers to detailed project rules.

## Rules & Reference Directory

Detailed rules, coding style guidelines, architectural boundaries, and review standards are maintained in the `.agents/rules/` directory:

- [`.agents/rules/code-style.md`](.agents/rules/code-style.md): TypeScript and Vue 3 `<script setup lang="ts">` conventions, guard clauses, explicit `<button type="...">` attributes, semantic landmarks and strict `h1 -> h2 -> h3` heading hierarchy, unabbreviated identifier naming, signature Neapolitan ice cream palette tokens (`#68293A`, `#FF5776`, `#F6E6D7`, `#E3C7B9`), `DM Serif Display` / `Inter` / `JetBrains Mono` typography, `.ribbon` and `.btn-ribbon` hanging bookmark buttons, parameterized SQL and XSS/SQLi sanitization, 6-locale parity (`en`, `ph`, `es`, `ja`, `ko`, `zh`), and 1,000-line file limits.
- [`.agents/rules/code-review.md`](.agents/rules/code-review.md): Architectural review standards, SOLID principles audit across Nuxt 3 / Vue 3 / Nitro / database adapters, additive UI preservation audit, simplicity, readability, business-friendly copy restraint, and zero bloat.
- [`.agents/rules/workflow.md`](.agents/rules/workflow.md): User intent, additive UI preservation protocol, bug handling protocols, verification checkpoints (`bun test`, `bunx nuxi typecheck`, `bun run build`), artifact hygiene, and conventional commit policy.
- [`.agents/rules/architecture.md`](.agents/rules/architecture.md): Managed terminal preset lifecycle, 1-to-many preset propagation (`managed_preset_key` & `/api/presets/sync`), single database layer (`lib/db.ts`) over SQLite locally and Firestore in production, selected by `lib/backend.ts`, canvas builder & runtime event execution (`useCanvasRuntime`), SSE realtime sync (`realtimeHub`), role-based permissions, audit logging, and SEO middleware.
- [`.agents/rules/resource-order.md`](.agents/rules/resource-order.md): Deterministic Nuxt 3 project directory hierarchy, layer separation (`lib/`, `composables/`, `components/`, `pages/`, `server/`, `locales/`, `tests/`), API route naming, 6-locale key ordering, and resource registration checklist.

Additional design and agent references:

- [`DESIGN-DOCUMENT.md`](DESIGN-DOCUMENT.md): Product summary, target users, workstation preset workflows (Cashier Register, Kitchen Display, Inventory Manager, Catalog Registrar, Reports Viewer), scope boundaries, layout bundles, and onboarding flow.
- [`CLAUDE.md`](CLAUDE.md): Dedicated operating guide for Claude agents (skill/MCP/subagent maximization, additive design preservation, and lightweight SaaS alignment).
- [`GEMINI.md`](GEMINI.md): Dedicated operating guide for Gemini / Antigravity agents (Gemini 4 Hydrogen XHigh model mandate, native swarm execution, and additive design preservation).
- [`DEPLOYMENT.md`](DEPLOYMENT.md): Local SQLite and Firebase Spark/Blaze deployment instructions.
- [`HANDOFF.md`](HANDOFF.md): Historical engineering context and architectural decisions across milestones.

You can view the `.agents/rules/` folder for code rules and review purposes.

---

## Core Operating Invariants

### 1. Support & Extend What We Have — Never Replace or Strip Early-Version Elements Unless Explicitly Stated

> [!IMPORTANT]
> **Additive Evolution Mandate**: When improving UI, UX, features, SEO, or architecture, agents **must support, preserve, and build upon Kogane's established early-version elements, components, page sections, and visual identity**. Never delete, strip, or replace existing UI elements, CSS classes, or workflows unless the user explicitly instructs you to remove them.

- **Signature "Neapolitan Ice Cream" Aesthetic**: Preserve Kogane's warm, approachable Neapolitan palette and typography across all marketing, auth, dashboard, and builder surfaces:
  - **Chocolate Maroon**: `#68293A` (`--k-dark`, `--k-ink`, `--shell-sidebar`, deep hover `#4A1A27` / `#4d1e2b`)
  - **Strawberry Pink**: `#FF5776` (`--k-accent`, `--shell-pink`, `brand-pink`, hover `#E84362`, soft tint `#FFEBEF`)
  - **Vanilla Cream**: `#F6E6D7` (`--k-cream`, `bg1`, warm page background `#FFFDFB`, alt surface `#FBF4ED`)
  - **Blush**: `#E3C7B9` (`--k-blush`, `bg1-dark`)
  - **Typography**: `DM Serif Display` for wordmarks and headings, `Inter` for clean UI controls and body copy, and `JetBrains Mono` (`tabular-nums`) for terminal IDs, slugs, and operational metrics.
- **Hanging Bookmark Ribbon Tails (`.ribbon` & `.btn-ribbon`)**: Primary call-to-action buttons on marketing/public pages must retain `.ribbon` (`.m-btn-primary.ribbon`, `.m-btn-dark.ribbon`, `.m-btn-light.ribbon`), and primary action buttons in the dashboard, builder, and auth screens must retain `.btn-ribbon` (`.btn-primary.btn-ribbon`, `.btn-pink.btn-ribbon`). Never flatten or remove the hanging bookmark tail (`clip-path: polygon(0 0, 100% 0, 100% 100%, 50% 52%, 0 100%)`).
- **Established Page Sections & Visual Components**: Keep original page sections and structural classes intact when adding new capabilities alongside them, including:
  - Marketing layout (`layouts/marketing.vue`): `.m-header`, `.m-logo`, `.m-nav-link`, `.m-lang-btn`, `.m-footer`, and `.m-footer-brand-col`.
  - Homepage (`pages/index.vue`): `.m-overline` pill with `.m-overline-dot`, `.hero-preview` with `.preview-card`, `.preview-bar`, `.preview-dots`, `.preview-chip-row`, and `.preview-metrics`; `.industries-strip` with `.industry-chip` pills; `.section-pillars` with `.pillar-card`s; `.section-philosophy` with `.philosophy-badges` 2x2 grid (`.badge-plain`, `.badge-dark`, `.badge-brand`, `.badge-outline`); and `.m-cta-strip` with `.m-btn-primary.ribbon`.
  - Features (`pages/features.vue`): `.feat-hero`, alternating `.module-section` blocks (`module--cream`, `module--maroon`, `module--pink`, `module--cream`) with `.module-visual`, `.visual-blob`, and interactive `.visual-card` previews, `.section-extras` 6-card `.extra-card` grid, and `.m-cta-strip`.
  - Pricing (`pages/pricing.vue`): `.pricing-hero` with `.m-btn-primary.ribbon`, SaaS pricing tier cards with `.m-btn-primary.ribbon`, `.section-pillars` (`.pillar-card`), `.section-workstations` (`.station-card`), FAQ `<details>`, and `.m-cta-strip`.
  - Auth & Legal (`pages/login.vue`, `pages/signup.vue`, `pages/privacy.vue`, `pages/terms.vue`): `.login-blob` ambient background circles, `.btn-ribbon` submit buttons, and warm editorial legal headers.
- **Product Simplicity**: Kogane is a practical, dependable SaaS Terminal Builder for everyday businesses—not over-designed luxury software or an intimidating developer database console.

### 2. Artifacts & User Intent

- Disregard unintentional spelling mistakes in user prompts; preserve intentional wording and domain terms.
- Do not generate media assets (images, audio, videos, icons) unless explicitly requested.
- Place any temporary verification scripts, scratch harnesses, or test outputs in untracked temporary folders and remove them when no longer needed. Never commit transient SQLite files (`*.sqlite`, `*.sqlite-wal`, `*.sqlite-shm`), `.nuxt/`, `.output/`, or scratch files.

### 3. Handling Bug Reports

- Treat error reports, test failures, typecheck diagnostics, crashes, and UI regressions as direct instructions to investigate and fix immediately. Do not ask for permission to start the repair.
- Implement focused fixes within the reported scope while preserving all existing UI elements and unrelated code.

### 4. Verification & Commit Checkpoints

- Follow the sequence: **implement -> verify -> fix failures -> commit**. Treat each testable change as its own checkpoint.
- Verify changes proportionately using:
  - `bun test` (unit, security, preset propagation, realtime, audit, and SEO test suites)
  - `bunx nuxi typecheck` (or `bunx vue-tsc --noEmit` for strict TypeScript and Vue template checking)
  - `bun run build` (`bun --bun nuxt build` for full SSR and Nitro server bundle verification)
- Name all commits using conventional commit format: `feat(scope):`, `fix(scope):`, `docs(scope):`, `refactor(scope):`, `perf(scope):`, `test(scope):`, `chore(scope):`.
- Stage only files belonging to that checkpoint; preserve unrelated user edits.

### 5. Branch Naming

- Whenever you create a branch, give it a conventional prefix so branches are easy to separate and categorize at a glance. Use the format `<prefix>/<short-kebab-case-description>` (for example `feat/preset-version-history`, `fix/kitchen-display-modal`, `experiment/home-editorial-redesign`).
- Pick the prefix that matches the purpose of the work:

  | Prefix | Purpose |
  | :--- | :--- |
  | `feat/` | New features |
  | `fix/` | Bug fixes |
  | `refactor/` | Code restructuring with no behavior change |
  | `design/` | UI/UX changes |
  | `style/` | Visual or styling changes |
  | `experiment/` | Experimental ideas that may not be merged |
  | `chore/` | Maintenance tasks |
  | `docs/` | Documentation |

- Keep one purpose per branch. If the work outgrows its prefix (an `experiment/` that is ready to ship), open a new branch with the right prefix instead of renaming history.
- The long-lived `main` and `dev` branches are the only branches without a prefix.
