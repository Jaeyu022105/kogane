# Kogane Production Deployment Guide

Kogane is an operational workstation and preset-driven terminal system designed for business environments (Cashier POS, Kitchen Display System, Catalog Registrar, Inventory Manager, and Reports Viewer).

---

## 1. Architecture Overview

- **Frontend & App Framework**: Nuxt 3 + Vue 3 (Vite, Tailwind CSS, Lucide icons).
- **Runtime**: Bun (or Node.js 18+).
- **Database Engine**:
  - **Local / Self-hosted / Single-node**: SQLite via `bun:sqlite` (`DEV_MODE=true`).
  - **Cloud Production**: Supabase / PostgreSQL (`DEV_MODE=false`).
- **Continuous Real-Time Sync**:
  - Native Server-Sent Events (SSE) via `/api/realtime/stream` for zero-configuration, instant cross-terminal push updates across all networks and LAN devices.
  - Supabase Realtime integration for PostgreSQL replication in enterprise cloud deployments.
  - Automatic fallback, heartbeat monitoring, and optimistic UI mutations.

---

## 2. Option A: Docker Container Deployment (Recommended for On-Premise & VPS)

### Prerequisites
- Docker Engine 20.10+
- Docker Compose v2+

### Quick Start

1. Clone or copy the repository onto your production server:
   ```bash
   git clone <repo-url> /opt/kogane
   cd /opt/kogane
   ```

2. Create your `.env` configuration:
   ```bash
   cp .env.example .env
   ```

3. Configure your server URL / LAN address:
   ```env
   NODE_ENV=production
   PORT=3000
   DEV_MODE=true
   NUXT_PUBLIC_SHARE_ORIGIN=https://kogane.yourdomain.com
   ```

4. Build and start the container:
   ```bash
   docker compose up -d --build
   ```

5. Check container logs and health:
   ```bash
   docker compose logs -f
   docker ps
   ```

The container automatically persists the SQLite database in the `kogane-data` Docker volume at `/app/data/dev.db`.

---

## 3. Option B: Supabase Cloud Production Deployment

### 1. Database Setup in Supabase
1. Create a project at [supabase.com](https://supabase.com).
2. Open the **SQL Editor** in the Supabase dashboard.
3. Paste and run the entire contents of `supabase/schema.sql`.
   This creates:
   - Platform core tables: `businesses`, `terminals`, `presets`, `audit_log`.
   - The required secure RPC functions: `execute_query` and `execute_ddl`.
   - Realtime publication rules and lookup indexes.

### 2. Application Server Configuration
Set the following environment variables on your deployment platform (VPS, Railway, Fly.io, or Render):

```env
NODE_ENV=production
DEV_MODE=false
SUPABASE_URL=https://<your-project-id>.supabase.co
SUPABASE_ANON_KEY=<your-anon-public-key>
SUPABASE_SERVICE_KEY=<your-service-role-key>
NUXT_PUBLIC_SHARE_ORIGIN=https://kogane.yourdomain.com
```

### 3. Build & Run
```bash
bun install --frozen-lockfile
bun run build
bun run .output/server/index.mjs
```

---

## 4. Option C: LAN Multi-Device Workstation Deployment (School / Retail / Restaurant)

To run Kogane on a counter laptop and allow kitchen tablets, cashier phones, and manager PCs on the same Wi-Fi network to connect:

1. Determine your computer's local IP address:
   - Windows: `ipconfig` (look for IPv4 address, e.g. `192.168.1.45`)
   - Mac/Linux: `ip a` or `ifconfig`

2. Set `NUXT_PUBLIC_SHARE_ORIGIN` in your `.env`:
   ```env
   NUXT_PUBLIC_SHARE_ORIGIN=http://192.168.1.45:3000
   ```

3. Launch with LAN bindings:
   ```bash
   bun run preview:lan
   # Or for development:
   bun run dev:lan
   ```

4. Open `http://192.168.1.45:3000` from any phone or tablet on the same Wi-Fi. Copied terminal links will automatically include the correct LAN address.

---

## 5. Real-Time Synchronization Verification

Kogane features continuous real-time synchronization across all stations:
- **Cashier Register -> Kitchen Display**: As soon as an order is submitted at the counter, the Kitchen Display receives an instant SSE push event and updates the order queue without manual refreshing.
- **Kitchen Display -> Cashier Queue**: Tapping the order status badge on the Kitchen Display advances status (`PENDING` -> `PREPARING` -> `FULFILLED`), broadcasting the change to cashier and manager screens in real time.
- **Catalog -> Cashier Products**: Adding or modifying items in the Catalog Registrar automatically pushes updates to cashier product panels.

---

## 6. Health Check & Monitoring

The production build includes a built-in health check:
- **HTTP Endpoint**: `GET http://127.0.0.1:3000/` returns `200 OK`.
- **Docker Healthcheck**: Configured to ping every 30 seconds with automatic recovery.
- **Audit Logs**: All terminal and admin mutations are recorded to the `audit_log` table with timestamps, terminal identifiers, and before/after payloads.
