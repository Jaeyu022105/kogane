# Postfolio

A **schema-driven internal tool builder**. Define your database, build your UI, and deploy role-based staff terminals — all without writing code.

---

## Stack

| Layer      | Technology                          |
|------------|-------------------------------------|
| Runtime    | Bun                                 |
| Framework  | Nuxt 3 (Vue 3, Composition API)     |
| Styling    | Tailwind CSS + CSS variables        |
| DB (dev)   | SQLite via `better-sqlite3`         |
| DB (prod)  | Supabase (Postgres)                 |
| Auth       | Supabase Auth (prod) / mock (dev)   |

---

## Getting Started

```bash
# Install dependencies
bun install

# Start dev server (uses SQLite, no Supabase needed)
bun run dev

# Seed built-in presets
bun run seed:presets
```

Open [http://localhost:3000](http://localhost:3000) — login with any email in dev mode.

---

## Environment

```env
DEV_MODE=true              # true = SQLite, false = Supabase

# Only needed when DEV_MODE=false
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_KEY=...
```

---

## Project Structure

```
postfolio/
├── lib/
│   ├── db.ts              # Unified DB abstraction (switch point)
│   ├── db-sqlite.ts       # SQLite adapter (dev)
│   ├── db-supabase.ts     # Supabase adapter (prod)
│   ├── schemaUtils.ts     # SQL generation + normalization analysis
│   ├── authUtils.ts       # JWT verification + PIN hashing
│   └── uiTypes.ts         # Shared UI element type definitions
│
├── composables/
│   ├── useAuth.ts         # Admin session state
│   ├── useBusiness.ts     # Business profile + theme injection
│   ├── useCanvas.ts       # Builder canvas state + undo
│   └── useSchema.ts       # Schema API wrapper
│
├── server/api/
│   ├── auth/              # Dev login
│   ├── businesses/        # Create, fetch, theme
│   ├── inpoints/          # CRUD, PIN login, layout save
│   ├── schema/tables/     # DDL management + analysis
│   ├── presets/           # Preset templates
│   └── data/              # Generic query + insert
│
├── components/
│   ├── Canvas.vue          # Builder drag/resize canvas
│   ├── ElementRenderer.vue # Central element dispatch
│   ├── PropertiesPanel.vue # Inspector panel
│   └── elements/           # Isolated element components
│       ├── ButtonEl.vue
│       ├── TextEl.vue
│       ├── ImageEl.vue
│       ├── TableViewEl.vue
│       ├── InputFieldEl.vue
│       └── CartWidgetEl.vue
│
├── pages/
│   ├── login.vue
│   ├── dashboard/
│   │   ├── index.vue       # Overview
│   │   ├── database.vue    # Schema editor
│   │   ├── builder.vue     # UI builder
│   │   ├── terminals.vue   # In-point management
│   │   └── settings.vue    # Theme + business config
│   └── inpoint/[id].vue    # Staff terminal view
│
└── layouts/
    ├── default.vue          # Bare shell (login)
    └── dashboard.vue        # Sidebar + nav
```

---

## Architecture Principles

- **DB abstraction**: all server code imports from `lib/db.ts` — never adapters directly
- **Element modularity**: adding a new element type = one new `*El.vue` + one line in `ElementRenderer.vue`
- **Schema safety**: all SQL identifiers validated against `/^[a-z][a-z0-9_]{0,62}$/` before any DDL
- **Theming**: CSS variables on `:root` — updated at runtime from business palette, reflected everywhere

---

## Multi-Tenancy

Each business gets its own namespace:

- **SQLite (dev)**: table name prefix `biz_<id>_<tablename>`
- **Postgres (prod)**: separate schema `biz_<id>`

---

## Adding a New Element Type

1. Create `components/elements/MyEl.vue` — receives `element` prop, emits `action`
2. Add the type to `lib/uiTypes.ts` — extend `ElementDef` union
3. Register in `components/ElementRenderer.vue` — one line in `ELEMENT_COMPONENT_MAP`
4. Add a section to `components/PropertiesPanel.vue` — `v-if="selectedElement.type === 'my-el'"`
5. Add to the palette in `pages/dashboard/builder.vue` — one entry in `PALETTE_ITEMS`
