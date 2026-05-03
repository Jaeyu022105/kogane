# Postfolio — Schema-Driven Internal Tool Builder

Postfolio is a high-performance, modular platform designed to help businesses build, deploy, and manage custom internal tools. It bridges the gap between raw database management and specialized user interfaces, allowing you to create everything from POS terminals and inventory trackers to staff dashboards without writing a single line of frontend code.

---

## ✦ Core Philosophy

Most internal tools are either too rigid (SaaS) or too ugly (custom-built). **Postfolio** is built on the belief that internal tools should feel as premium as the products they support.

- **Schema-First**: Your data defines your capability. Design your database schema directly within the platform.
- **UI-Driven**: Build interfaces using a Figma-like visual canvas. Drag, drop, and configure.
- **Terminal Isolation**: Deploy role-based "Terminals" that are isolated, secure, and authenticated via PIN.
- **Dynamic Theming**: Brand colors and typography propagate instantly across every generated interface.

---

## 🛠 The Engine

| Layer | Technology |
| :--- | :--- |
| **Runtime** | [Bun](https://bun.sh) (Ultra-fast JavaScript runtime) |
| **Framework** | [Nuxt 3](https://nuxt.com) (Vue 3, Composition API) |
| **Styling** | Vanilla CSS + [Tailwind CSS](https://tailwindcss.com) |
| **Database (Dev)** | SQLite via `better-sqlite3` (Local persistence) |
| **Database (Prod)** | Supabase / PostgreSQL (Production scale) |

---

## 📐 How it Works

### 1. Database Editor
Define your domain model. Postfolio handles the DDL (Data Definition Language) for you. It features an **Interactive Table Editor** for direct inline data manipulation and a **Relational Schema Visualizer** that draws dynamic connection arrows for foreign keys. It includes a built-in **Normalization Analyzer** that suggests schema improvements (targeting 3.5NF / Boyce-Codd) to ensure your data stays clean as you scale.

### 2. UI Builder
A professional, Figma/Canva-inspired design environment. Design staff-facing screens using modular elements like Table Views, Cart Widgets, and Input Fields. It features:
- **Event System**: Build complex logic without writing code—like mapping an input field's value to a database insert action triggered by a button click.
- **Transactional Branching**: Create reliable workflows with conditional execution (`condition` JS expressions) and nested `onSuccess` / `onFailure` event routing.
- **Hardware Integration**: Built-in support for hardware barcode and QR scanners via burst-mode analysis, seamlessly bridging the gap between physical inputs and web events.
- **Smart Properties**: A dynamic top bar for quick style adjustments, paired with a collapsible advanced properties sidebar for deep customization.
- **Canvas Controls**: Infinite panning and scaling, along with standard keybinds (`Ctrl+C`, `Ctrl+V`, `Ctrl+D`) for rapid prototyping.

### 3. Terminals
Deploy specific layouts to physical or web-based terminals. The interface is hydrated dynamically from the JSON layout definition and scaled to fit any screen perfectly.
- **Staff Access**: Traditional role-based access secured by a staff PIN lock screen.
- **Public / Kiosk Mode**: Easily spin up anonymous, public-facing terminals (e.g., self-serve kiosks, digital menus) with a unique URL slug (`/t/[slug]`).
- **Context Injection**: Pass contextual data via URL parameters (e.g., `?table_id=3`) directly into the terminal's event runtime as `$$session.*` variables for powerful dynamic interactions.

---

## 🎨 Aesthetics & Experience

Postfolio features a "Cream & Maroon" design system:
- **Typography**: A harmonious blend of *Inter* (sans-serif) for utility and *DM Serif Display* (serif) for elegance.
- **Interface**: A warm, tactile feel with soft shadows, rounded corners, and micro-animations.
- **Staff View**: Minimalist and high-contrast, optimized for efficiency and low cognitive load.

---

## 🚀 Getting Started

```bash
# 1. Install dependencies
bun install

# 2. Seed built-in presets (Café POS, CRM, Inventory)
bun run seed:presets

# 3. Start the development server
bun run dev
```

### Environment Config
Postfolio uses a hybrid database strategy. Toggle between local development and production Supabase via `.env`:

```env
DEV_MODE=true  # Uses local dev.db (SQLite)
# If false, requires SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_KEY
```

---

## 🏗 Modular Architecture

Postfolio is designed for extension. Adding a new widget (e.g., a "Scanner" or "Chart") is a standardized process:
1. Define the **Element Schema** in `lib/uiTypes.ts`.
2. Create the **Vue Component** in `components/elements/`.
3. Register the component in the **Element Renderer**.
4. Add the configuration fields to the **Properties Panel**.

---

*Built with passion for clean code and beautiful interfaces.*
