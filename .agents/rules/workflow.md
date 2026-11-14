# Kogane Workflow & Agent Rules

This guide outlines workflow procedures, additive UI preservation protocols, bug repair standards, verification checkpoints, and commit policies for **Kogane**.

---

## 1. User Intent, Additive Preservation & Artifacts

- **Support & Extend What We Have (Additive Invariant)**:
  - **Never remove, strip, or replace early-version UI elements, page sections, or visual characteristics unless the user explicitly asks to remove them.**
  - Treat feature requests, SaaS upgrades, copy refinements, and SEO enhancements as **additive improvements** built on top of Kogane's existing structures.
  - Always preserve Kogane's signature **Neapolitan ice cream design style**: chocolate maroon (`#68293A`), strawberry pink (`#FF5776`), vanilla cream (`#F6E6D7`), blush (`#E3C7B9`), `DM Serif Display` headings, and hanging `.ribbon` / `.btn-ribbon` bookmark tails on primary buttons.
- **Spelling and Typos**: Disregard unintentional spelling mistakes in user prompts and follow the intended meaning without asking about obvious typos. Preserve intentional wording and product terminology.
- **Media Asset Policy**: Do not generate media assets (images, audio, videos, icons) unless the user explicitly requests asset generation.
- **Temporary Artifacts & Workspace Hygiene**:
  - Place any temporary verification scripts, scratch harnesses, or test outputs in untracked temporary directories and delete them before committing.
  - Never commit transient SQLite database files (`*.sqlite`, `*.sqlite-shm`, `*.sqlite-wal`), build outputs (`.nuxt/`, `.output/`), or temporary scratch files.

---

## 2. Handling Bug Reports

- **Immediate Action**: When the user points out an error, failing test, TypeScript diagnostic, broken layout, or regression—including pasted terminal logs or screenshots without an explicit "fix this"—treat it as a direct instruction to investigate and fix it immediately.
- **No Permission Requests**: Do not ask "Do you want me to fix it?" or wait for approval before repairing a bug.
- **Focused Fixes**: Investigate the root cause, implement a clean fix within the reported scope, preserve all existing UI elements and unrelated code, run verification checks, and report the outcome.
- **Targeted Clarification**: Ask for clarification only when essential requirements cannot be determined from the codebase, logs, or conversation history.
- **Explanation-Only Requests**: If the user explicitly asks for an explanation only or instructs you not to edit files, follow that instruction strictly.

---

## 3. Verification & Commit Checkpoints

- **Checkpoint Sequence**: Every feature, UI enhancement, bug fix, or refactor must follow this sequence:
  1. **Implement** the change cleanly following [`.agents/rules/code-style.md`](code-style.md) and [`.agents/rules/architecture.md`](architecture.md).
  2. **Verify** the change using automated tests, typechecking, and build checks.
  3. **Fix** any test failures, type errors, or regressions uncovered during verification.
  4. **Commit** the verified checkpoint before moving to the next independent task.
- **Standard Verification Commands**:
  - **Unit, Security, Preset & SEO Tests**:
    ```bash
    bun test
    ```
    (or run targeted test files with `bun test tests/<name>.test.ts` during iteration, followed by the full relevant suite).
  - **TypeScript & Vue Template Typecheck**:
    ```bash
    bunx nuxi typecheck
    ```
    (or `bunx vue-tsc --noEmit`).
  - **Production SSR & Nitro Bundle Build**:
    ```bash
    bun run build
    ```
    (`bun --bun nuxt build`).
- **Isolated Commits**: Stage only the files belonging to the current checkpoint. Keep unrelated changes in separate commits so history remains bisect-friendly and easy to review.
- **Conventional Commit Messages**: Format every commit message as `type(scope): description` or `type: description`:
  - Common types: `feat(presets):`, `feat(ui):`, `fix(runtime):`, `fix(audit):`, `fix(seo):`, `docs(agents):`, `refactor(db):`, `perf(realtime):`, `test(security):`, `chore(build):`.
  - Keep commit descriptions concise, active, and clear.
- **Clean Commits**: Never commit a checkpoint while relevant tests, typechecks, or builds are failing. Resolve all issues caused by your change before committing.
