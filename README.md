# Kogane

Kogane is a preset-driven terminal system for small and medium businesses. It helps owners set up practical web-based workstations, such as cashier registers, kitchen displays, product catalog desks, inventory boards, and reporting consoles, without writing frontend code.

Kogane is designed for daily users: choose a business setup, let Kogane create the needed data tables, then customize and share ready-made terminals.

---

## Core Idea

- Preset-first: start from useful cashier, kitchen, inventory, catalog, and reporting terminals.
- UI-driven: customize terminal layouts in a visual builder.
- Browser-based: run terminals on PCs, tablets, phones, or other devices with a modern browser.
- Local-first: SQLite through Bun on your PC or counter machine.
- Production: Firebase Cloud Firestore, picked automatically when Firebase credentials are set.

---

## Tech Stack

| Layer | Technology |
| :--- | :--- |
| Runtime | Bun |
| Framework | Nuxt 3 / Vue 3 |
| Styling | Tailwind CSS and custom CSS |
| Database (local) | SQLite through Bun |
| Database (production) | Firebase Cloud Firestore |

---

## Main Features

### Onboarding

The onboarding flow creates the business workspace, applies branding, provisions starter tables, and generates starter terminal UI layouts.

### Dashboard

The dashboard is the admin area for business owners. It includes overview actions, terminal cards, database tools, reports, audit logs, settings, and access to the UI builder where available.

### Terminals

Terminals are staff-facing screens. They can be opened privately through `/terminal/[id]` or shared through public links like `/t/[slug]`.

Current terminal presets include:

- Cashier Register
- Kitchen Display
- Catalog Registrar
- Inventory Manager
- Reports Viewer

### UI Builder

The UI Builder lets admins customize terminal layouts, colors, station objects, widgets, charts, tables, forms, cart behavior, and terminal themes.

---

## Getting Started On Your PC

```bash
# 1. Install dependencies
bun install

# 2. Start the development server on this PC
bun run dev
```

Open `http://localhost:3000` on the PC running the project.

In dev mode, you can log in with any email and password. If the workspace is empty, complete onboarding so Kogane creates the starter tables and terminals.

---

## Run On Another Device

To show Kogane on a phone, tablet, or another laptop connected to the same Wi-Fi:

```bash
bun run dev:lan
```

Then run this in PowerShell to find your PC IPv4 address:

```powershell
ipconfig
```

Open this on the other device:

```text
http://<your-pc-ip>:3000
```

Example:

```text
http://192.168.1.25:3000
```

---

## Environment Config

Server code talks to one database layer (`lib/db.ts`), and `lib/backend.ts` decides which engine runs it. Local demos use SQLite:

```env
DEV_MODE=true
DATABASE_URL=./dev.db
```

Optional LAN helper for copied terminal links:

```env
NUXT_PUBLIC_SHARE_ORIGIN=http://192.168.1.25:3000
```

For production, turn off dev mode and add Firebase credentials. The server switches to Cloud Firestore on its own:

```env
DEV_MODE=false
FIREBASE_SERVICE_ACCOUNT_JSON=<raw or base64 service account JSON>
```

See `.env.example` for upload storage options (Spark vs Blaze) and the full list.

Do not commit your real `.env`. Use `.env.example` as the safe template.

---

## Build And Preview

For a production-like local preview:

```bash
bun run build
bun run preview
```

For a production-like preview available to other devices on the same Wi-Fi:

```bash
bun run build
bun run preview:lan
```

---

## Modular Architecture

Adding a new widget or station object usually involves:

1. Define the element schema in `lib/uiTypes.ts`.
2. Create or update the Vue component in `components/elements/`.
3. Register the renderer where elements are mapped to components.
4. Add configuration controls in `components/PropertiesPanel.vue`.
5. Add starter layouts or station objects in `lib/builderPresets.ts`, `lib/stationObjects.ts`, or `lib/starterWorkstations.ts`.

---

Built for clean, practical, browser-based business terminals.
