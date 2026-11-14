# Gemini & Antigravity Agent Guide for Kogane (`GEMINI.md`)

This document defines the operating rules, model selection policy, swarm orchestration standards, and design preservation invariants for **Gemini / Google Antigravity** agents working in the **Kogane** repository. Read this alongside [`AGENTS.md`](AGENTS.md), [`DESIGN-DOCUMENT.md`](DESIGN-DOCUMENT.md), and the detailed engineering rules in [`.agents/rules/`](.agents/rules/).

---

## 1. Primary Model Mandate

> [!IMPORTANT]
> **Default Model**: Always run on **Gemini 4 Hydrogen (XHigh)** (`gemini-4-hydrogen-xhigh`) for both the coordinator and every swarm worker or subagent.

- **Coordinator & Worker Default**: When spawning swarm workers (`swarm{action:"add"}`), leave `model` unset when you are already running on `gemini-4-hydrogen-xhigh`, or explicitly pin `model:"gemini-4-hydrogen-xhigh"` so every agent in the roster operates at maximum reasoning depth.
- **Fallback Policy (Quota / Capacity Exhaustion Only)**: Only switch to **Gemini 4 Argon (High)** (`gemini-4-argon-high`) if `gemini-4-hydrogen-xhigh` quota or capacity is exhausted or when explicitly requested by the user.
- **Model Switching Procedure**: When a model switch is required due to quota exhaustion, use `swarm{action:"model", name, model:"gemini-4-argon-high"}` (or omit `name` to switch yourself) so the agent keeps its full conversation history and resumes work seamlessly. Always state why the switch occurred; **never** `kill` and `add` a worker just to change its model.

---

## 2. Swarm Parallelism & Skill Execution

- **Native Swarm Orchestration**: For multi-file features, audits, or full-stack updates, decompose the work into independent slices with **strict disjoint file ownership**:
  - Spawn parallel authors with `workspace:"share"` so each author edits and tests in its own isolated git worktree without colliding with peers.
  - State each worker's exact owned files, forbidden files, reference docs, and verification commands in its public brief.
  - Spawn a dedicated **verifier** (`workspace:"inherit"` or inspecting integrated branches) so code is checked by an agent other than its author before final delivery.
  - Integrate and merge every worker's verified branch into the target branch before calling `swarm{action:"kill"}` (since `kill` permanently deletes `share` and `branch` worktrees).
- **Board Discipline**:
  - Keep board posts concise, factual, and referenced by sequence number (`#12`).
  - Never post greetings or empty acknowledgments (`"ready"`, `"acknowledged"`).
  - Use `@name` only as a wakeup doorbell for the specific agent that must act next; tag `@coordinator` when your deliverable is committed and verified or when blocked on a coordinator decision.
- **Skill & Tool Activation**: Always check and follow relevant skills (`SKILL.md`) and built-in tools before starting specialized workflows.

---

## 3. Support & Preserve Existing Design and Code (Additive Invariant)

> [!IMPORTANT]
> **Support & Extend What We Have — Never Replace or Strip Early-Version Elements Unless Explicitly Stated.**

- **Additive Evolution Only**: Follow [`AGENTS.md`](AGENTS.md) and [`.agents/rules/`](.agents/rules/) strictly. Always support and build on top of existing Kogane UI elements, components, page sections, and workflows. Never delete, strip, or replace early-version features or visual characteristics unless the user explicitly asks to remove them.
- **Preserve the Signature Neapolitan Ice Cream Design Style**:
  - **Chocolate Maroon**: `#68293A` (`--k-dark`, `--k-ink`, `--shell-sidebar`, deep `#4A1A27` / `#4d1e2b`)
  - **Strawberry Pink**: `#FF5776` (`--k-accent`, `--shell-pink`, `brand-pink`, hover `#E84362`, soft `#FFEBEF`)
  - **Vanilla Cream**: `#F6E6D7` (`--k-cream`, `bg1`, warm background `#FFFDFB`, alt surface `#FBF4ED`)
  - **Blush**: `#E3C7B9` (`--k-blush`, `bg1-dark`)
  - **Typography**: `DM Serif Display` wordmark and headings, `Inter` body and UI controls, `JetBrains Mono` (`tabular-nums`) for IDs, slugs, and operational metrics.
- **Preserve Hanging Bookmark Ribbon Buttons (`.ribbon` & `.btn-ribbon`)**:
  - Marketing and public pages must retain `.ribbon` on primary CTA buttons (`.m-btn-primary.ribbon`, `.m-btn-dark.ribbon`, `.m-btn-light.ribbon`).
  - Dashboard, builder, and auth pages must retain `.btn-ribbon` on primary action buttons (`.btn-primary.btn-ribbon`, `.btn-pink.btn-ribbon`).
- **Preserve Established Page Sections**:
  - Retain all established sections across `layouts/marketing.vue`, `pages/index.vue` (`.m-overline`, `.preview-card` with `.preview-dots`, `.industry-chip`, `.pillar-card`, `.philosophy-badges`, `.m-cta-strip`), `pages/features.vue` (`.feat-hero`, alternating `.module-section`s with `.visual-blob` + `.visual-card`, `.extra-card` grid, `.m-cta-strip`), `pages/pricing.vue` (`.pricing-hero`, SaaS plans grid, `.pillar-card`s, `.station-card`s, FAQ `<details>`, `.m-cta-strip`), and `pages/login.vue` (`.login-blob`, `.btn-ribbon`).

---

## 4. Product Goal & Verification Standards

- **Practical SaaS Terminal Builder**: Keep Kogane focused as a lightweight, dependable SaaS Terminal Builder where businesses launch ready-made workstation presets (Cashier Register, Kitchen Display, Inventory Manager, Catalog Registrar, Reports Viewer) and **1 platform improvement updates every connected terminal automatically**.
- **Verification Checkpoints**: Every author and verifier must validate changes with:
  - `bun test` (full or targeted test suite in `tests/*.test.ts`)
  - `bunx nuxi typecheck` (or `bunx vue-tsc --noEmit`)
  - `bun run build` (`bun --bun nuxt build`)
- **Commit Policy**: Commit verified work using conventional commit format (`feat(scope):`, `fix(scope):`, `docs(scope):`, `refactor(scope):`, `test(scope):`) and keep the working tree clean of temporary artifacts.
