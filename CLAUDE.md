# Claude Agent Guide for Kogane (`CLAUDE.md`)

This document defines the operating rules and execution priorities for **Claude** agents (Claude Code, IDE integrations, and subagents) working in the **Kogane** repository. Read this alongside [`AGENTS.md`](AGENTS.md), [`DESIGN-DOCUMENT.md`](DESIGN-DOCUMENT.md), and the detailed engineering rules in [`.agents/rules/`](.agents/rules/).

---

## 1. Maximize Skill, Tool & Subagent Utilization

- **Leverage Every Relevant Installed Capability**: Always inspect and use all relevant installed skills (`SKILL.md`), MCP server tools, slash workflows, and subagents to complete tasks thoroughly and efficiently. Never improvise brittle, manual one-off workarounds when a dedicated skill, CLI tool, or test harness covers the workflow.
- **Parallelize Independent Work Safely**: When a task spans multiple independent slices (such as backend endpoints, frontend pages, localization dictionaries, and regression tests) or needs an independent audit, delegate disjoint file slices or verification passes to subagents with clear ownership boundaries.
- **Read Rules Before Editing**: Before modifying code or UI templates, consult:
  - [`AGENTS.md`](AGENTS.md)
  - [`.agents/rules/architecture.md`](.agents/rules/architecture.md)
  - [`.agents/rules/code-style.md`](.agents/rules/code-style.md)
  - [`.agents/rules/code-review.md`](.agents/rules/code-review.md)
  - [`.agents/rules/resource-order.md`](.agents/rules/resource-order.md)
  - [`.agents/rules/workflow.md`](.agents/rules/workflow.md)

---

## 2. Support & Preserve Existing Design and Code (Additive Invariant)

> [!IMPORTANT]
> **Support & Extend What We Have — Never Replace or Strip Early-Version Elements Unless Explicitly Stated.**

- **Additive Improvements Only**: When asked to upgrade a page, refine copy, add interactivity, or improve SEO/accessibility, **build on top of Kogane's existing structures**. Never delete, strip, or replace established sections, cards, badges, ambient decorations, or CSS classes unless the user explicitly asks to remove them.
- **Preserve the Signature Neapolitan Ice Cream Style**:
  - **Chocolate Maroon (`#68293A`)**: Primary ink, dark sections, sidebar surface (`--k-dark`, `--k-ink`, `--shell-sidebar`), with deep maroon (`#4A1A27` / `#4d1e2b`) for hover/active states.
  - **Strawberry Pink (`#FF5776`)**: Brand accent, highlights, active badges, and primary buttons on dark maroon backgrounds (`--k-accent`, `--shell-pink`, `brand-pink`).
  - **Vanilla Cream (`#F6E6D7`) & Warm White (`#FFFDFB`)**: Soft editorial backgrounds and light button surfaces (`--k-cream`, `--k-bg`, `bg1`).
  - **Blush (`#E3C7B9`)**: Warm hairline borders, subtle badges, and secondary surfaces (`--k-blush`, `bg1-dark`).
  - **Typography**: `DM Serif Display` for wordmarks and headings, `Inter` for UI controls and body text, and `JetBrains Mono` (`tabular-nums`) for IDs, slugs, and numeric metrics.
- **Preserve Hanging Bookmark Ribbon Buttons (`.ribbon` & `.btn-ribbon`)**:
  - Marketing and public pages use `.m-btn-primary.ribbon`, `.m-btn-dark.ribbon`, and `.m-btn-light.ribbon` (`assets/css/marketing.css`).
  - Dashboard, builder, and auth screens use `.btn-primary.btn-ribbon` and `.btn-pink.btn-ribbon` (`assets/css/tailwind.css`).
  - Always keep these hanging bookmark tails on primary action buttons.
- **Preserve Established UI Sections**:
  - Keep `.preview-card` (with `.preview-dots`, `.preview-chip-row`, `.preview-metrics`), `.industries-strip` (`.industry-chip`), `.section-pillars` (`.pillar-card`), `.section-philosophy` (`.philosophy-badges` 2x2 grid), `.section-workstations` (`.station-card`), alternating `.module-section` blocks (`.visual-blob` + `.visual-card`), `.section-extras` (`.extra-card`), `.m-cta-strip`, and `.login-blob` elements intact while integrating new SaaS sections (such as interactive preset explorers or pricing tier comparisons) additively.

---

## 3. Product Goal Alignment

- **Lightweight, Practical SaaS Terminal Builder**: Kogane is built for everyday small and medium businesses (coffee shops, restaurants, retail counters, stockrooms, clinics, and dispatch desks). Keep the interface warm, approachable, fast to scan, and immediately useful—never turn it into cold enterprise bloatware or over-designed luxury software.
- **Configure Once, Propagate Everywhere**: Uphold Kogane's core architectural promise: admins configure a terminal preset once (`lib/builderPresets.ts`, `lib/starterWorkstations.ts`, `lib/stationObjects.ts`), and **1 platform improvement or preset update propagates to every connected terminal automatically** (`managed_preset_key`, `POST /api/presets/sync`, `server/utils/managedTerminals.ts`).
- **Plain Business Language**: Keep user-facing copy clear and action-oriented across all 6 supported locales (`en`, `ph`, `es`, `ja`, `ko`, `zh`). Avoid exposing raw database jargon (`DDL`, `schema migration`, `ORM`) in staff or business-owner workflows.

---

## 4. Verification & Commit Discipline

Before considering any task or checkpoint complete:

1. **Run Automated Tests**: Execute `bun test` and ensure all unit, integration, security, preset sync, realtime, audit, and SEO tests pass.
2. **Run Type Checking**: Execute `bunx nuxi typecheck` (or `bunx vue-tsc --noEmit`) and resolve any TypeScript or Vue template diagnostics without resorting to `any` casts.
3. **Run Production Build**: Execute `bun run build` (`bun --bun nuxt build`) when modifying pages, composables, server routes, or configuration.
4. **Commit Cleanly**: Use conventional commit messages (`feat(scope):`, `fix(scope):`, `docs(scope):`, `refactor(scope):`, `test(scope):`) and never commit temporary scratch files.
